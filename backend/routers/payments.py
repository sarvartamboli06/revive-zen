"""Payments and Razorpay Webhook Router."""

import json
import logging
from typing import Any, Dict
from fastapi import APIRouter, Header, HTTPException, Request, status
from backend.database import db
from backend.services.audit_service import audit_service
from backend.services.razorpay_service import razorpay_service

logger = logging.getLogger("recoverai.payments")

router = APIRouter(prefix="/api/webhooks", tags=["Payments & Webhooks"])

@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None),
):
    """Receive and process Razorpay webhook notifications.

    Validates webhook signature, identifies the case, marks it recovered,
    updates transaction status, and creates an audit log.
    """
    body_bytes = await request.body()
    
    # 1. Validate signature
    if not razorpay_service.verify_webhook_signature(body_bytes, x_razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": "Invalid webhook signature"},
        )

    try:
        data: Dict[str, Any] = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": "Malformed JSON payload"},
        )

    event_type = data.get("event", "")
    logger.info("Received Razorpay Webhook event: %s", event_type)

    # Check for payment success events
    success_events = ["payment.captured", "payment_link.paid", "order.paid"]
    if event_type in success_events:
        payload = data.get("payload", {})
        case_id = None

        # Extract case_id from notes or reference_id
        if "payment_link" in payload:
            entity = payload["payment_link"].get("entity", {})
            case_id = (entity.get("notes") or {}).get("case_id") or entity.get("reference_id")
        
        if not case_id and "payment" in payload:
            entity = payload["payment"].get("entity", {})
            case_id = (entity.get("notes") or {}).get("case_id") or entity.get("description")

        if not case_id and "order" in payload:
            entity = payload["order"].get("entity", {})
            case_id = (entity.get("notes") or {}).get("case_id")

        if not case_id and "case_id" in data:
            case_id = data.get("case_id")

        if case_id:
            case = db.fetch_one("recovery_cases", {"case_id": case_id})
            if not case:
                # Try finding by transaction_id
                case = db.fetch_one("recovery_cases", {"transaction_id": case_id})

            if not case:
                logger.warning("Webhook received for unknown case/transaction: %s", case_id)
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"success": False, "error": f"Unknown transaction / recovery case: '{case_id}'"},
                )

            # Check if already recovered (duplicate webhook protection)
            if str(case.get("status", "")).strip().capitalize() == "Recovered":
                logger.info("Webhook duplicate ignored: case %s is already marked Recovered", case_id)
                return {
                    "status": "ignored",
                    "message": "Payment already recovered for this case (duplicate webhook ignored)",
                    "case_id": case.get("case_id"),
                    "recovered": True,
                }

            resolved_case_id = case.get("case_id")
            amount = float(case.get("amount", 0))

            # 1. Update recovery case in Supabase
            db.update("recovery_cases", {"case_id": resolved_case_id}, {"status": "Recovered"})

            # 2. Update transaction in Supabase
            db.update(
                "transactions",
                {"transaction_id": case.get("transaction_id")},
                {
                    "status": "Recovered",
                    "recovery_status": "Recovered by RecoverAI",
                },
            )

            # 3. Update customer revenue in Supabase
            customer_id = case.get("customer_id")
            if customer_id:
                cust = db.fetch_one("customers", {"id": customer_id})
                if cust:
                    prev_rec = float(cust.get("recovered_revenue", 0))
                    prev_tot = float(cust.get("total_revenue", 0))
                    succ_cnt = int(cust.get("successful_payments", 0)) + 1
                    db.update("customers", {"id": customer_id}, {
                        "recovered_revenue": prev_rec + amount,
                        "total_revenue": prev_tot + amount,
                        "successful_payments": succ_cnt,
                    })

            # 4. Insert recovery action in Supabase
            db.insert(
                "recovery_actions",
                {
                    "case_id": resolved_case_id,
                    "action": "Razorpay Webhook Recovery",
                    "reason": f"Payment captured via Razorpay ({event_type})",
                    "result": f"₹{amount:,.2f} recovered successfully via Razorpay webhook",
                    "performed_by": "Razorpay Webhook",
                },
            )

            # 5. Record audit log in Supabase
            audit_service.log(
                case_id=resolved_case_id,
                event="Payment Recovered",
                decision=case.get("ai_decision"),
                action="Razorpay Webhook Verified",
                performed_by="Razorpay",
                result=f"₹{amount:,.2f} recovered via Razorpay webhook ({event_type})",
            )

            return {
                "status": "success",
                "case_id": resolved_case_id,
                "recovered": True,
                "amount": amount,
                "event": event_type,
            }

    return {"status": "ignored", "event": event_type}

@router.get("/razorpay/status")
def get_razorpay_status():
    """Return safe Razorpay configuration status (never exposes secret credentials)."""
    return razorpay_service.get_status()

