"""Audit Logs Router."""

from typing import List
from fastapi import APIRouter, Query
from backend.models.schemas import AuditLogResponse
from backend.services.audit_service import audit_service

router = APIRouter(prefix="/api/audit", tags=["Audit"])

@router.get("", response_model=List[AuditLogResponse])
def get_all_audit_logs(limit: int = Query(100, ge=1, le=500)):
    """Retrieve complete audit history across all recovery cases."""
    logs = audit_service.get_logs(limit=limit)
    return [AuditLogResponse(**log) for log in logs]

@router.get("/{case_id}", response_model=List[AuditLogResponse])
def get_case_audit_logs(case_id: str, limit: int = Query(100, ge=1, le=500)):
    """Retrieve audit history for a specific case."""
    logs = audit_service.get_logs(case_id=case_id, limit=limit)
    return [AuditLogResponse(**log) for log in logs]
