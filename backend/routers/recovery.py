"""Recovery Cases Router."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from backend.database import db
from backend.models.schemas import (
    AnalyzeCaseResponse,
    EscalateRequest,
    ExecuteRecoveryRequest,
    ExecuteRecoveryResponse,
    PaymentLinkResponse,
    RecoveryCaseCreate,
    RecoveryCaseResponse,
    StopRequest,
)
from backend.services.audit_service import audit_service
from backend.services.razorpay_service import razorpay_service
from backend.services.recovery_engine import recovery_engine

router = APIRouter(prefix="/api/recovery-cases", tags=["Recovery Cases"])

def enrich_case(c: Dict[str, Any]) -> RecoveryCaseResponse:
    """Enrich case with customer details, timeline, and frontend compatibility fields."""
    customer_id = c.get("customer_id")
    customer_name = "Unknown"
    cust = None
    if customer_id:
        cust = db.fetch_one("customers", {"id": customer_id})
        if cust:
            customer_name = cust.get("name", "Unknown")

    # Fetch audit logs to build timeline
    case_id = c.get("case_id")
    logs = db.fetch_all("audit_logs", {"case_id": case_id}, order_by="created_at", limit=20)
    timeline = []
    for entry in logs:
        actor = str(entry.get("performed_by", "AI Agent")).lower()
        kind = "ai" if "ai" in actor else ("system" if "system" in actor else "human")
        timeline.append({
            "at": entry.get("created_at"),
            "label": entry.get("event"),
            "detail": entry.get("result") or entry.get("action") or "",
            "kind": kind,
        })

    # Prepare AI reasoning list
    ai_reason = c.get("ai_reason") or "Standard automated recovery analysis."
    amount = float(c.get("amount", 0))
    reasoning_list = [
        f"Payment failure of ₹{amount:,.0f} detected due to: {c.get('problem_type') or 'Failure'}.",
        ai_reason,
    ]
    if cust:
        reasoning_list.append(
            f"Customer {cust.get('name')} has {cust.get('successful_payments', 0)} successful transactions."
        )

    return RecoveryCaseResponse(
        id=c.get("id"),
        case_id=c.get("case_id"),
        transaction_id=c.get("transaction_id"),
        customer_id=customer_id or "",
        customer_name=customer_name,
        amount=amount,
        problem_type=c.get("problem_type", "Payment Failed"),
        recovery_probability=int(c.get("recovery_probability", 0)),
        priority=c.get("priority", "Medium"),
        ai_decision=c.get("ai_decision", "Pending Analysis"),
        ai_reason=ai_reason,
        recommended_action=c.get("recommended_action", "Send Smart Payment Link"),
        attempts=int(c.get("attempts", 0)),
        contacts=int(c.get("contacts", 0)),
        status=c.get("status", "Detected"),
        payment_link=c.get("payment_link"),
        created_at=c.get("created_at"),
        updated_at=c.get("updated_at"),
        # frontend mirrors
        caseId=c.get("case_id"),
        customerId=customer_id,
        customerName=customer_name,
        transactionId=c.get("transaction_id"),
        problem=c.get("problem_type"),
        probability=int(c.get("recovery_probability", 0)),
        aiDecision=c.get("ai_decision"),
        aiReasoning=reasoning_list,
        recommendedAction=c.get("recommended_action"),
        paymentLink=c.get("payment_link"),
        timeline=timeline,
    )

@router.get("", response_model=List[RecoveryCaseResponse])
def get_recovery_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    limit: int = Query(100, ge=1, le=500),
):
    """List recovery cases with optional status or priority filtering."""
    filters = {}
    if status_filter:
        filters["status"] = status_filter
    if priority_filter:
        filters["priority"] = priority_filter

    cases = db.fetch_all("recovery_cases", filters=filters or None, order_by="-amount", limit=limit)
    return [enrich_case(c) for c in cases]

@router.get("/{case_id}", response_model=RecoveryCaseResponse)
def get_recovery_case(case_id: str):
    """Retrieve details of a specific recovery case."""
    case = db.fetch_one("recovery_cases", {"case_id": case_id})
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Recovery case '{case_id}' not found"},
        )
    return enrich_case(case)

@router.post("", response_model=RecoveryCaseResponse, status_code=status.HTTP_201_CREATED)
def create_recovery_case(payload: RecoveryCaseCreate):
    """Directly create a new recovery case with duplicate prevention."""
    existing = db.fetch_one("recovery_cases", {"case_id": payload.case_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"success": False, "error": f"Recovery case '{payload.case_id}' already exists"},
        )

    # Ensure parent transaction exists to satisfy Supabase foreign key constraint
    tx = db.fetch_one("transactions", {"transaction_id": payload.transaction_id})
    if not tx:
        db.insert("transactions", {
            "transaction_id": payload.transaction_id,
            "customer_id": payload.customer_id,
            "amount": payload.amount,
            "payment_method": "Payment Gateway",
            "status": "Failed",
            "failure_reason": payload.ai_reason or "Payment Failed",
            "recovery_status": "Case Created",
        })

    case_data = {
        "case_id": payload.case_id,
        "transaction_id": payload.transaction_id,
        "customer_id": payload.customer_id,
        "amount": payload.amount,
        "problem_type": payload.problem_type or "Payment Failed",
        "recovery_probability": 0,
        "priority": payload.priority or ("High" if payload.amount >= 50000 else "Medium"),
        "ai_decision": "Pending Analysis",
        "ai_reason": payload.ai_reason or "Payment failure detected",
        "recommended_action": "payment_link",
        "attempts": 0,
        "contacts": 0,
        "status": "Detected",
        "payment_link": None,
    }
    saved_case = db.insert("recovery_cases", case_data)
    audit_service.log(
        case_id=payload.case_id,
        event="Recovery Case Created",
        decision="Pending Analysis",
        action="Case Created",
        performed_by="System",
        result=f"Amount ₹{payload.amount:,.2f} at risk",
    )
    return enrich_case(saved_case)


@router.post("/{case_id}/analyze", response_model=AnalyzeCaseResponse)
def analyze_case(case_id: str):
    """Run explainable AI reasoning on the case and store decision & audit log."""
    case = db.fetch_one("recovery_cases", {"case_id": case_id})
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Recovery case '{case_id}' not found"},
        )

    # Fetch corresponding customer and transaction
    customer = db.fetch_one("customers", {"id": case.get("customer_id")})
    tx = db.fetch_one("transactions", {"transaction_id": case.get("transaction_id")})
    if tx and tx.get("failure_reason"):
        case["failure_reason"] = tx.get("failure_reason")

    # Evaluate using rule-based recovery engine
    analysis = recovery_engine.evaluate_case(case, customer)

    # Update recovery case in database
    update_data = {
        "recovery_probability": analysis["probability"],
        "priority": analysis["priority"],
        "ai_decision": analysis["decision"],
        "recommended_action": analysis["recommended_action"],
        "ai_reason": analysis["reason"],
    }
    if str(case.get("status", "")).capitalize() not in ("Recovered", "Stopped"):
        update_data["status"] = analysis["status"]

    db.update("recovery_cases", {"case_id": case_id}, update_data)

    # Log audit event
    audit_service.log(
        case_id=case_id,
        event="AI Analysis Completed",
        decision=analysis["decision"],
        action=analysis["recommended_action"],
        performed_by="AI Agent",
        result=f"Recovery probability {analysis['probability']}% — {analysis['priority']} priority",
    )

    return AnalyzeCaseResponse(
        case_id=case_id,
        recovery_probability=analysis["probability"],
        priority=analysis["priority"],
        ai_decision=analysis["decision"],
        recommended_action=analysis["recommended_action"],
        ai_reason=analysis["reason"],
    )

@router.post("/{case_id}/execute", response_model=ExecuteRecoveryResponse)
def execute_recovery(case_id: str, payload: Optional[ExecuteRecoveryRequest] = None):
    """Execute bounded recovery action checking guardrails first."""
    case = db.fetch_one("recovery_cases", {"case_id": case_id})
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Recovery case '{case_id}' not found"},
        )

    # Guardrail evaluation
    allowed, block_reason = recovery_engine.validate_guardrails(case)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": block_reason},
        )

    attempts = int(case.get("attempts", 0)) + 1
    contacts = int(case.get("contacts", 0)) + 1
    action_to_take = (payload and payload.action) or case.get("recommended_action") or "Send Smart Payment Link"

    limit_reached = attempts >= recovery_engine.MAX_ATTEMPTS
    new_status = "Stopped" if limit_reached else "Recovery Initiated"

    # Update database
    db.update(
        "recovery_cases",
        {"case_id": case_id},
        {
            "attempts": attempts,
            "contacts": contacts,
            "status": new_status,
        },
    )

    # Record action
    result_text = "Attempt limit reached — recovery stopped" if limit_reached else f"Executed {action_to_take}"
    db.insert(
        "recovery_actions",
        {
            "case_id": case_id,
            "action": action_to_take,
            "reason": case.get("ai_reason") or "Automated recovery execution",
            "result": result_text,
            "performed_by": "AI Agent",
        },
    )

    # Audit log
    audit_entry = audit_service.log(
        case_id=case_id,
        event=f"Recovery Attempt {attempts}",
        decision=case.get("ai_decision"),
        action=action_to_take,
        performed_by="AI Agent",
        result=result_text,
    )

    return ExecuteRecoveryResponse(
        success=True,
        case_id=case_id,
        status=new_status,
        attempts=attempts,
        contacts=contacts,
        action_taken=action_to_take,
        audit_id=audit_entry.get("id"),
        message=result_text,
    )

@router.post("/{case_id}/payment-link", response_model=PaymentLinkResponse)
def create_payment_link(case_id: str):
    """Generate a Razorpay Test Mode Payment Link after checking guardrails."""
    case = db.fetch_one("recovery_cases", {"case_id": case_id})
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Recovery case '{case_id}' not found"},
        )

    # Validate guardrails
    allowed, block_reason = recovery_engine.validate_guardrails(case)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": block_reason},
        )

    # Get customer details
    customer = db.fetch_one("customers", {"id": case.get("customer_id")}) or {}
    cust_name = customer.get("name", "Customer")
    cust_email = customer.get("email", "customer@example.com")
    cust_phone = customer.get("phone", "+919876543210")
    amount = float(case.get("amount", 0))

    # Create link via Razorpay service
    success, link_url, _ = razorpay_service.create_payment_link(
        case_id=case_id,
        amount=amount,
        customer_name=cust_name,
        customer_email=cust_email,
        customer_phone=cust_phone,
    )

    # Update case with link and increment contacts
    contacts = int(case.get("contacts", 0)) + 1
    new_status = "Recovery Initiated" if case.get("status") != "Recovered" else "Recovered"
    db.update(
        "recovery_cases",
        {"case_id": case_id},
        {
            "payment_link": link_url,
            "contacts": contacts,
            "status": new_status,
        },
    )

    # Record action
    db.insert(
        "recovery_actions",
        {
            "case_id": case_id,
            "action": "Generate Payment Link",
            "reason": "Payment link requested for customer recovery",
            "result": f"Generated Razorpay Test link {link_url}",
            "performed_by": "AI Agent",
        },
    )

    # Log audit
    audit_service.log(
        case_id=case_id,
        event="Payment Link Generated",
        decision=case.get("ai_decision"),
        action="Send Smart Payment Link",
        performed_by="AI Agent",
        result=f"Delivered Razorpay Test link: {link_url}",
    )

    return PaymentLinkResponse(
        success=True,
        case_id=case_id,
        payment_link=link_url,
        amount=amount,
        status=new_status,
        message="Payment link generated and saved successfully",
    )

@router.post("/{case_id}/mark-recovered", response_model=RecoveryCaseResponse)
def mark_recovered(case_id: str):
    """Mark recovery case and associated transaction as recovered, updating customer revenue."""
    case = db.fetch_one("recovery_cases", {"case_id": case_id})
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Recovery case '{case_id}' not found"},
        )

    if case.get("status") == "Recovered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": "Payment already recovered for this case"},
        )

    amount = float(case.get("amount", 0))

    # Update recovery case
    db.update(
        "recovery_cases",
        {"case_id": case_id},
        {"status": "Recovered"},
    )

    # Update transaction
    db.update(
        "transactions",
        {"transaction_id": case.get("transaction_id")},
        {
            "status": "Recovered",
            "recovery_status": "Recovered by RecoverAI",
        },
    )

    # Update customer recovered revenue
    customer_id = case.get("customer_id")
    if customer_id:
        cust = db.fetch_one("customers", {"id": customer_id})
        if cust:
            prev_recovered = float(cust.get("recovered_revenue", 0))
            db.update(
                "customers",
                {"id": customer_id},
                {"recovered_revenue": prev_recovered + amount},
            )

    # Record action
    db.insert(
        "recovery_actions",
        {
            "case_id": case_id,
            "action": "Mark Recovered",
            "reason": "Payment verified and collected",
            "result": f"₹{amount:,.2f} recorded as recovered revenue",
            "performed_by": "System",
        },
    )

    # Audit log
    audit_service.log(
        case_id=case_id,
        event="Payment Recovered",
        decision=case.get("ai_decision"),
        action="Verify and Credit Payment",
        performed_by="System",
        result=f"₹{amount:,.2f} recovered successfully",
    )

    updated_case = db.fetch_one("recovery_cases", {"case_id": case_id})
    return enrich_case(updated_case)

@router.post("/{case_id}/escalate", response_model=RecoveryCaseResponse)
def escalate_case(case_id: str, payload: Optional[EscalateRequest] = None):
    """Escalate case to human review."""
    case = db.fetch_one("recovery_cases", {"case_id": case_id})
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Recovery case '{case_id}' not found"},
        )

    note = (payload and payload.note) or "Case handed to revenue operations team for manual review."

    db.update(
        "recovery_cases",
        {"case_id": case_id},
        {
            "status": "Escalated",
            "ai_decision": "Human Review Required",
        },
    )

    db.insert(
        "recovery_actions",
        {
            "case_id": case_id,
            "action": "Escalate to Human Review",
            "reason": note,
            "result": "Assigned to human revenue operations",
            "performed_by": "Human",
        },
    )

    audit_service.log(
        case_id=case_id,
        event="Recovery Escalated",
        decision="Human Review Required",
        action="Escalate to Human Review",
        performed_by="Human",
        result=note,
    )

    updated_case = db.fetch_one("recovery_cases", {"case_id": case_id})
    return enrich_case(updated_case)

@router.post("/{case_id}/stop", response_model=RecoveryCaseResponse)
def stop_case(case_id: str, payload: Optional[StopRequest] = None):
    """Stop further recovery attempts on this case."""
    case = db.fetch_one("recovery_cases", {"case_id": case_id})
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Recovery case '{case_id}' not found"},
        )

    reason = (payload and payload.reason) or "Recovery stopped manually."

    db.update(
        "recovery_cases",
        {"case_id": case_id},
        {
            "status": "Stopped",
            "ai_decision": "Recovery Blocked",
        },
    )

    db.insert(
        "recovery_actions",
        {
            "case_id": case_id,
            "action": "Stop Recovery",
            "reason": reason,
            "result": "All recovery actions halted",
            "performed_by": "Human",
        },
    )

    audit_service.log(
        case_id=case_id,
        event="Recovery Stopped",
        decision="Manual stop",
        action="Disable further attempts",
        performed_by="Human",
        result=reason,
    )

    updated_case = db.fetch_one("recovery_cases", {"case_id": case_id})
    return enrich_case(updated_case)

@router.get("/{case_id}/actions")
def get_case_actions(case_id: str):
    """Retrieve recovery actions recorded in Supabase for this case."""
    actions = db.fetch_all("recovery_actions", {"case_id": case_id}, order_by="created_at", limit=50)
    return {"case_id": case_id, "actions": actions}

