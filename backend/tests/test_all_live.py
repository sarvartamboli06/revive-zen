"""Live integration test verifying all required endpoints on running server."""

import sys
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_all():
    results = {}
    
    # 1. Health
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200 and r.json()["status"] == "healthy"
    results["GET /health"] = "PASS"

    # 2. Docs
    r = requests.get(f"{BASE_URL}/docs")
    assert r.status_code == 200
    results["GET /docs"] = "PASS"

    # 3. CORS Preflight
    r = requests.options(
        f"{BASE_URL}/api/dashboard",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        }
    )
    assert r.status_code == 200 and r.headers.get("access-control-allow-origin") == "http://localhost:5173"
    results["CORS (http://localhost:5173)"] = "PASS"

    # 4. Dashboard
    r = requests.get(f"{BASE_URL}/api/dashboard")
    assert r.status_code == 200 and "revenue_at_risk" in r.json() and "revenueRecovered" in r.json()
    results["GET /api/dashboard"] = "PASS"

    # 5. Transactions
    r = requests.get(f"{BASE_URL}/api/transactions")
    assert r.status_code == 200 and len(r.json()) > 0
    tx_id = r.json()[0]["transaction_id"]
    r2 = requests.get(f"{BASE_URL}/api/transactions/{tx_id}")
    assert r2.status_code == 200 and r2.json()["transaction_id"] == tx_id
    results["GET /api/transactions & {id}"] = "PASS"

    # 6. Customers
    r = requests.get(f"{BASE_URL}/api/customers")
    assert r.status_code == 200 and len(r.json()) >= 50
    cust_id = r.json()[0]["id"]
    r2 = requests.get(f"{BASE_URL}/api/customers/{cust_id}")
    assert r2.status_code == 200 and r2.json()["id"] == cust_id
    results["GET /api/customers & {id}"] = "PASS"

    # 7. Recovery Cases list & get
    r = requests.get(f"{BASE_URL}/api/recovery-cases")
    assert r.status_code == 200 and len(r.json()) > 0
    results["GET /api/recovery-cases"] = "PASS"

    # 8. Recovery Analysis (Case 1: Rahul Sharma, ₹18,500)
    r = requests.post(f"{BASE_URL}/api/recovery-cases/RC-10428/analyze")
    assert r.status_code == 200 and r.json()["recovery_probability"] == 82
    results["POST /api/recovery-cases/{id}/analyze"] = "PASS"

    # Create a fresh active case for testing remaining actions
    test_case_id = "RC-LIVE-DEMO"
    tx_payload = {
        "transaction_id": "TXN-LIVE-DEMO",
        "customer_id": "CUS-1010",
        "amount": 14500.0,
        "payment_method": "HDFC Credit Card",
        "status": "Failed",
        "failure_reason": "payment_timeout",
    }
    requests.post(f"{BASE_URL}/api/transactions", json=tx_payload)

    # 9. Payment link generation
    r = requests.post(f"{BASE_URL}/api/recovery-cases/{test_case_id}/payment-link")
    assert r.status_code == 200 and r.json()["success"] is True and "http" in r.json()["payment_link"]
    results["POST /api/recovery-cases/{id}/payment-link"] = "PASS"

    # 10. Execute recovery
    r = requests.post(f"{BASE_URL}/api/recovery-cases/{test_case_id}/execute")
    assert r.status_code == 200 and r.json()["success"] is True
    results["POST /api/recovery-cases/{id}/execute"] = "PASS"

    # 11. Escalate case
    r = requests.post(f"{BASE_URL}/api/recovery-cases/{test_case_id}/escalate", json={"note": "Escalated for test"})
    assert r.status_code == 200 and r.json()["status"] == "Escalated"
    results["POST /api/recovery-cases/{id}/escalate"] = "PASS"

    # 12. Stop recovery
    r = requests.post(f"{BASE_URL}/api/recovery-cases/{test_case_id}/stop", json={"reason": "Stop test"})
    assert r.status_code == 200 and r.json()["status"] == "Stopped"
    results["POST /api/recovery-cases/{id}/stop"] = "PASS"

    # 13. Mark recovered
    r = requests.post(f"{BASE_URL}/api/recovery-cases/{test_case_id}/mark-recovered")
    assert r.status_code == 200 and r.json()["status"] == "Recovered"
    results["POST /api/recovery-cases/{id}/mark-recovered"] = "PASS"

    # 14. Audit trail
    r = requests.get(f"{BASE_URL}/api/audit")
    assert r.status_code == 200 and len(r.json()) > 0
    r2 = requests.get(f"{BASE_URL}/api/audit/{test_case_id}")
    assert r2.status_code == 200 and len(r2.json()) >= 3
    results["GET /api/audit & {case_id}"] = "PASS"

    # 15. Razorpay Webhook
    wh_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_live_test_123",
                    "amount": 1450000,
                    "notes": {"case_id": test_case_id}
                }
            }
        }
    }
    r = requests.post(
        f"{BASE_URL}/api/webhooks/razorpay",
        json=wh_payload,
        headers={"X-Razorpay-Signature": "live_test_signature"}
    )
    assert r.status_code == 200 and r.json()["status"] == "success"
    results["POST /api/webhooks/razorpay"] = "PASS"

    # 16. Guardrail block on high value (Vikram Patil, ₹75,000)
    r = requests.post(f"{BASE_URL}/api/recovery-cases/RC-10429/execute")
    assert r.status_code == 400 and r.json()["success"] is False and "high-value" in r.json()["error"].lower()
    results["Guardrail: High-Value Threshold Block"] = "PASS"

    # 17. Guardrail block on max attempts (Pooja Gupta, 3 attempts)
    r = requests.post(f"{BASE_URL}/api/recovery-cases/RC-10430/execute")
    assert r.status_code == 400 and r.json()["success"] is False
    results["Guardrail: Max Attempts Block"] = "PASS"

    print("\n--- ALL ENDPOINT VERIFICATION RESULTS ---")
    for ep, status in results.items():
        print(f"  [+] {ep.ljust(45)}: {status}")
    print("------------------------------------------\nALL 17 TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all()
