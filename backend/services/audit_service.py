"""Audit Service for logging and retrieving immutable recovery events."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from backend.database import db

logger = logging.getLogger("recoverai.audit")

class AuditService:
    @staticmethod
    def log(
        case_id: str,
        event: str,
        decision: Optional[str] = None,
        action: Optional[str] = None,
        performed_by: str = "AI Agent",
        result: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Record an immutable audit entry."""
        now_iso = datetime.now(timezone.utc).isoformat()
        entry = {
            "case_id": case_id,
            "event": event,
            "decision": decision or "None",
            "action": action or "None",
            "performed_by": performed_by,
            "result": result or "",
            "created_at": now_iso,
        }
        saved = db.insert("audit_logs", entry)
        logger.info("[AUDIT] Case %s: %s by %s -> %s", case_id, event, performed_by, result)
        
        # Add frontend-compatible aliases
        saved["caseId"] = saved.get("case_id")
        saved["actor"] = saved.get("performed_by")
        saved["timestamp"] = saved.get("created_at")
        return saved

    @staticmethod
    def get_logs(case_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve audit logs optionally filtered by case_id."""
        filters = {"case_id": case_id} if case_id else None
        logs = db.fetch_all("audit_logs", filters=filters, order_by="-created_at", limit=limit)
        for entry in logs:
            entry["caseId"] = entry.get("case_id")
            entry["actor"] = entry.get("performed_by")
            entry["timestamp"] = entry.get("created_at")
        return logs

audit_service = AuditService()
