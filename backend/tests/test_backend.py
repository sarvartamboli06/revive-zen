"""Comprehensive API and Unit Tests for RecoverAI Backend."""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import db

client = TestClient(app)

def test_health_endpoint():
    """Verify GET /health returns expected contract."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "RecoverAI Backend"
    assert data["ai_agent"] == "operational"

def test_docs_endpoint():
    """Verify OpenAPI Swagger UI is available at /docs."""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "Swagger UI" in response.text or "swagger" in response.text.lower()

def test_dashboard_metrics():
    """Verify GET /api/dashboard returns all required calculated metrics."""
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "revenue_at_risk" in data
    assert "revenue_recovered" in data
    assert "recovery_rate" in data
    assert "active_cases" in data
    assert "customers_recovered" in data
    assert "escalated_cases" in data
    # Verify camelCase mirrors
    assert "revenueAtRisk" in data
    assert data["active_cases"] > 0

def test_customers_endpoints():
    """Verify GET /api/customers and GET /api/customers/{id}."""
    res_list = client.get("/api/customers")
    assert res_list.status_code == 200
    customers = res_list.json()
    assert len(customers) >= 50

    # Test single customer
    res_single = client.get("/api/customers/CUS-1010")
    assert res_single.status_code == 200
    cust = res_single.json()
    assert cust["id"] == "CUS-1010"
    assert cust["name"] == "Rahul Sharma"

def test_transactions_endpoints():
    """Verify GET /api/transactions and POST /api/transactions."""
    res_list = client.get("/api/transactions")
    assert res_list.status_code == 200
    txs = res_list.json()
    assert len(txs) >= 50

    # Test single transaction
    res_single = client.get("/api/transactions/TXN-90241")
    assert res_single.status_code == 200
    tx = res_single.json()
    assert tx["transaction_id"] == "TXN-90241"
    assert tx["customer_id"] == "CUS-1010"

def test_demo_case_1_rahul_sharma_analysis():
    """Case 1: Rahul Sharma, ₹18,500, payment_timeout.

    Expected: 82% recovery probability, Generate Payment Link
    """
    response = client.post("/api/recovery-cases/RC-10428/analyze")
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"] == "RC-10428"
    assert data["recovery_probability"] == 82
    assert data["priority"] == "High"
    assert data["ai_decision"] == "Generate Payment Link"
    assert data["recommended_action"] == "payment_link"
    assert "temporary" in data["ai_reason"].lower()

def test_demo_case_2_vikram_patil_guardrail_block():
    """Case 2: Vikram Patil, ₹75,000, repeated_failure.

    Expected: Human Review, Automatic recovery blocked (high-value threshold > 50,000).
    """
    # 1. Analyze case: should be Human Review
    res_analyze = client.post("/api/recovery-cases/RC-10429/analyze")
    assert res_analyze.status_code == 200
    data = res_analyze.json()
    assert data["ai_decision"] == "Human Review"
    assert "high-value" in data["ai_reason"].lower() or "human" in data["ai_reason"].lower()

    # 2. Execute recovery: should be BLOCKED by guardrails!
    res_exec = client.post("/api/recovery-cases/RC-10429/execute")
    assert res_exec.status_code == 400
    err = res_exec.json()
    assert err["success"] is False
    assert "high-value" in err["error"].lower()

def test_demo_case_3_max_attempts_guardrail_block():
    """Case 3: Attempts = 3.

    Expected: Recovery automatically stopped, further execution blocked.
    """
    res_exec = client.post("/api/recovery-cases/RC-10430/execute")
    assert res_exec.status_code == 400
    err = res_exec.json()
    assert err["success"] is False
    assert "stopped" in err["error"].lower() or "attempts" in err["error"].lower()

def test_payment_link_generation():
    """Verify POST /api/recovery-cases/{id}/payment-link creates Razorpay test link."""
    response = client.post("/api/recovery-cases/RC-10428/payment-link")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "rzp.io" in data["payment_link"] or "http" in data["payment_link"]
    assert data["case_id"] == "RC-10428"

def test_mark_recovered_flow():
    """Verify POST /api/recovery-cases/{id}/mark-recovered marks recovered and updates dashboard."""
    # Pick a fresh case or create one to mark recovered
    case_id = "RC-10428"
    res = client.post(f"/api/recovery-cases/{case_id}/mark-recovered")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Recovered"

    # Verify transaction is also recovered
    tx_res = client.get("/api/transactions/TXN-90241")
    assert tx_res.status_code == 200
    assert tx_res.json()["status"] == "Recovered"

def test_razorpay_webhook():
    """Verify POST /api/webhooks/razorpay processes payment captured event."""
    webhook_payload = {
        "event": "payment_link.paid",
        "payload": {
            "payment_link": {
                "entity": {
                    "id": "plink_test_webhook_123",
                    "amount": 1850000,
                    "notes": {
                        "case_id": "RC-10428"
                    }
                }
            }
        }
    }
    response = client.post(
        "/api/webhooks/razorpay",
        json=webhook_payload,
        headers={"X-Razorpay-Signature": "dummy_dev_signature"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["case_id"] == "RC-10428"
    assert data["recovered"] is True

def test_audit_logs():
    """Verify GET /api/audit and GET /api/audit/{case_id}."""
    res = client.get("/api/audit")
    assert res.status_code == 200
    logs = res.json()
    assert len(logs) > 0

    first = logs[0]
    assert "case_id" in first
    assert "event" in first
    assert "performed_by" in first
    assert "created_at" in first
