"""Customers Router."""

from typing import List
from fastapi import APIRouter, HTTPException, Query, status
from backend.database import db
from backend.models.schemas import CustomerCreate, CustomerResponse

router = APIRouter(prefix="/api/customers", tags=["Customers"])

def enrich_customer(c: dict) -> CustomerResponse:
    total_rev = float(c.get("total_revenue", 0))
    recov_rev = float(c.get("recovered_revenue", 0))
    if recov_rev == 0 and c.get("id"):
        cust_id = c.get("id")
        rec_txs = db.fetch_all("transactions", {"customer_id": cust_id, "status": "Recovered"})
        recov_rev = round(sum(float(tx.get("amount", 0)) for tx in rec_txs), 2)

    total_tx = int(c.get("total_transactions", 0))
    failed_tx = int(c.get("failed_payments", 0))

    return CustomerResponse(
        id=c.get("id"),
        name=c.get("name"),
        email=c.get("email"),
        phone=c.get("phone"),
        city=c.get("city") or "Mumbai",
        segment=c.get("segment") or "SMB",
        total_transactions=total_tx,
        successful_payments=int(c.get("successful_payments", 0)),
        failed_payments=failed_tx,
        total_revenue=total_rev,
        recovered_revenue=recov_rev,
        created_at=c.get("created_at"),
        # frontend mirrors
        lifetimeValue=total_rev,
        totalPayments=total_tx,
        failedPayments=failed_tx,
        recoveredRevenue=recov_rev,
    )


@router.get("", response_model=List[CustomerResponse])
def get_customers(limit: int = Query(100, ge=1, le=500)):
    """List all customers."""
    rows = db.fetch_all("customers", order_by="-total_revenue", limit=limit)
    return [enrich_customer(row) for row in rows]

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: str):
    """Get single customer by ID."""
    cust = db.fetch_one("customers", {"id": customer_id})
    if not cust:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Customer '{customer_id}' not found"},
        )
    return enrich_customer(cust)

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate):
    """Create a new customer."""
    existing = db.fetch_one("customers", {"id": payload.id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"success": False, "error": f"Customer '{payload.id}' already exists"},
        )
    data = payload.model_dump()
    created = db.insert("customers", data)
    return enrich_customer(created)

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: str, payload: CustomerCreate):
    """Update an existing customer."""
    existing = db.fetch_one("customers", {"id": customer_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": f"Customer '{customer_id}' not found"},
        )
    data = payload.model_dump(exclude={"id"})
    updated = db.update("customers", {"id": customer_id}, data)
    return enrich_customer(updated or existing)

