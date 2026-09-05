"""Transactions Router."""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from backend.database import db
from backend.models.schemas import TransactionCreate, TransactionResponse, TransactionUpdate
from backend.services.audit_service import audit_service

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

def enrich_transaction(tx: dict) -> TransactionResponse:
    """Add customer name and frontend-compatible camelCase properties."""
    customer_id = tx.get("customer_id")
    customer_name = "Unknown"
    if customer_id:
        cust = db.fetch_one("customers", {"id": customer_id})
        if cust:
            customer_name = cust.get("name", "Unknown")

    return TransactionResponse(
        id=tx.get("id"),
        transaction_id=tx.get("transaction_id"),
        customer_id=customer_id or "",
        amount=float(tx.get("amount", 0)),
        payment_method=tx.get("payment_method", ""),
        status=tx.get("status", "Failed"),
        failure_reason=tx.get("failure_reason"),
        recovery_status=tx.get("recovery_status", "Not Started"),
        created_at=tx.get("created_at"),
        # frontend mirrors
        customerId=customer_id,
        customerName=customer_name,
        method=tx.get("payment_method", ""),
        failureReason=tx.get("failure_reason"),
        recoveryStatus=tx.get("recovery_status", "Not Started"),
        date=tx.get("created_at"),
    )

@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
):
    """List all transactions with optional status filter."""
    filters = {"status": status_filter} if status_filter else None
    rows = db.fetch_all("transactions", filters=filters, order_by="-created_at", limit=limit)
    return [enrich_transaction(tx) for tx in rows]

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: str):
    """Get single transaction by its unique transaction_id."""
    tx = db.fetch_one("transactions", {"transaction_id": transaction_id})
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Transaction '{transaction_id}' not found"},
        )
    return enrich_transaction(tx)

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate):
    """Record a new payment transaction and initiate recovery case if failed."""
    existing = db.fetch_one("transactions", {"transaction_id": payload.transaction_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"success": False, "error": f"Transaction '{payload.transaction_id}' already exists"},
        )

    tx_data = payload.model_dump()
    saved_tx = db.insert("transactions", tx_data)

    # If transaction failed or abandoned, automatically create a recovery case
    if payload.status in ("Failed", "Abandoned"):
        case_id = f"RC-{payload.transaction_id.replace('TXN-', '')}"
        problem_type = "Checkout Abandoned" if payload.status == "Abandoned" else "Payment Failed"
        
        # Check if recovery case already exists
        existing_case = db.fetch_one("recovery_cases", {"case_id": case_id})
        if not existing_case:
            new_case = {
                "case_id": case_id,
                "transaction_id": payload.transaction_id,
                "customer_id": payload.customer_id,
                "amount": payload.amount,
                "problem_type": problem_type,
                "recovery_probability": 0,
                "priority": "Medium" if payload.amount < 50000 else "High",
                "ai_decision": "Pending Analysis",
                "ai_reason": payload.failure_reason or "Payment failed at gateway",
                "recommended_action": "payment_link",
                "attempts": 0,
                "contacts": 0,
                "status": "Detected",
                "payment_link": None,
            }
            db.insert("recovery_cases", new_case)
            audit_service.log(
                case_id=case_id,
                event="Payment Failure Detected",
                decision="Pending Analysis",
                action="Case Created",
                performed_by="System",
                result=f"Amount ₹{payload.amount:,.2f} at risk",
            )

    return enrich_transaction(saved_tx)

@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: str, payload: TransactionUpdate):
    """Update an existing transaction."""
    existing = db.fetch_one("transactions", {"transaction_id": transaction_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Transaction '{transaction_id}' not found"},
        )
    data = payload.model_dump(exclude_unset=True)
    updated = db.update("transactions", {"transaction_id": transaction_id}, data)
    return enrich_transaction(updated or existing)
