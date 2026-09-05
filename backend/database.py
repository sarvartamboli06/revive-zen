"""Supabase PostgreSQL database layer for RecoverAI.

Directly connects to Supabase PostgreSQL using the official Supabase Python client.
Requires SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from supabase import Client, create_client
from backend.config import settings

logger = logging.getLogger("recoverai.database")

def get_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def to_int_id(val: Any) -> int:
    if isinstance(val, int):
        return val
    digits = "".join(c for c in str(val) if c.isdigit())
    return int(digits) if digits else 1001

VALID_COLUMNS = {
    "customers": {
        "id", "name", "email", "phone", "total_transactions",
        "successful_payments", "failed_payments", "total_revenue", "created_at"
    },
    "transactions": {
        "id", "transaction_id", "customer_id", "amount",
        "payment_method", "status", "failure_reason", "recovery_status", "created_at"
    },
    "recovery_cases": {
        "id", "case_id", "transaction_id", "customer_id", "amount",
        "problem_type", "recovery_probability", "priority", "ai_decision",
        "ai_reason", "recommended_action", "attempts", "contacts",
        "status", "payment_link", "created_at", "updated_at"
    },
    "recovery_actions": {
        "id", "case_id", "action", "reason", "result", "performed_by", "created_at"
    },
    "audit_logs": {
        "id", "case_id", "event", "decision", "action", "performed_by", "result", "created_at"
    },
}

class SupabaseDatabaseManager:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_KEY
        self.client: Optional[Client] = None
        self._init_client()

    def _init_client(self):
        """Initialize the official Supabase client."""
        if self.url and self.key and "your-project" not in self.url:
            try:
                self.client = create_client(self.url, self.key)
                logger.info("Successfully connected to Supabase PostgreSQL at %s", self.url)
            except Exception as e:
                logger.error("Failed to initialize Supabase client: %s", e)
                self.client = None
        else:
            logger.warning(
                "Supabase credentials missing. Add SUPABASE_URL and SUPABASE_SECRET_KEY to backend/.env"
            )
            self.client = None

    def reload(self):
        """Reload credentials from settings."""
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_KEY
        self._init_client()

    def is_configured(self) -> bool:
        return bool(self.url and self.key and "your-project" not in self.url)

    def check_connection(self) -> Dict[str, Any]:
        """Verify live connectivity and detect tables."""
        if not self.client:
            self._init_client()
        if not self.client:
            return {
                "connected": False,
                "error": "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in backend/.env",
                "tables_detected": [],
            }

        detected_tables = []
        missing_tables = []
        test_tables = ["customers", "transactions", "recovery_cases", "recovery_actions", "audit_logs"]

        for table in test_tables:
            try:
                res = self.client.table(table).select("id", count="exact").limit(0).execute()
                detected_tables.append(table)
            except Exception as e:
                missing_tables.append({"table": table, "error": str(e)})

        is_healthy = len(detected_tables) == len(test_tables)
        return {
            "connected": is_healthy,
            "url": self.url,
            "tables_detected": detected_tables,
            "tables_missing": missing_tables,
            "error": None if is_healthy else "Some required tables missing in Supabase.",
        }

    def _require_client(self) -> Client:
        if not self.client:
            self._init_client()
        if not self.client:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "success": False,
                    "error": "Supabase database is not connected. Please configure SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env",
                },
            )
        return self.client

    def _sanitize_data(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Filter data to only valid columns and convert IDs to integer where needed."""
        valid_cols = VALID_COLUMNS.get(table)
        clean = {}
        for k, v in data.items():
            if valid_cols and k not in valid_cols:
                continue
            clean[k] = v

        if table == "customers" and "id" in clean:
            clean["id"] = to_int_id(clean["id"])
        elif "customer_id" in clean:
            clean["customer_id"] = to_int_id(clean["customer_id"])

        return clean

    def _format_row(self, table: str, row: Dict[str, Any]) -> Dict[str, Any]:
        """Format bigint IDs to CUS-XXXX for frontend compatibility."""
        if table == "customers" and "id" in row and isinstance(row["id"], int):
            row["id"] = f"CUS-{row['id']}"
        elif "customer_id" in row and isinstance(row["customer_id"], int):
            row["customer_id"] = f"CUS-{row['customer_id']}"
        return row

    # ----------------------------------------------------------------------
    # Supabase CRUD operations
    # ----------------------------------------------------------------------
    def fetch_all(
        self,
        table: str,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        client = self._require_client()
        try:
            query = client.table(table).select("*")
            if filters:
                for k, v in filters.items():
                    if table == "customers" and k == "id":
                        query = query.eq(k, to_int_id(v))
                    elif k == "customer_id":
                        query = query.eq(k, to_int_id(v))
                    else:
                        query = query.eq(k, v)
            if order_by:
                desc = order_by.startswith("-")
                col = order_by[1:] if desc else order_by
                query = query.order(col, desc=desc)
            if limit:
                query = query.limit(limit)

            res = query.execute()
            rows = res.data or []
            return [self._format_row(table, r) for r in rows]
        except Exception as e:
            logger.error("Supabase fetch_all error on %s: %s", table, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"success": False, "error": f"Supabase query error on table '{table}': {str(e)}"},
            )

    def fetch_one(self, table: str, filters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        data = self.fetch_all(table, filters=filters, limit=1)
        return data[0] if data else None

    def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        client = self._require_client()
        clean = self._sanitize_data(table, data)
        if "created_at" not in clean:
            clean["created_at"] = get_now_iso()
        try:
            res = client.table(table).insert(clean).execute()
            saved = res.data[0] if (res.data and len(res.data) > 0) else clean
            return self._format_row(table, saved)
        except Exception as e:
            logger.error("Supabase insert error on %s: %s", table, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"success": False, "error": f"Supabase insert error on table '{table}': {str(e)}"},
            )

    def update(self, table: str, filters: Dict[str, Any], data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        client = self._require_client()
        clean = self._sanitize_data(table, data)
        if "updated_at" not in clean and table == "recovery_cases":
            clean["updated_at"] = get_now_iso()
        try:
            query = client.table(table).update(clean)
            for k, v in filters.items():
                if table == "customers" and k == "id":
                    query = query.eq(k, to_int_id(v))
                elif k == "customer_id":
                    query = query.eq(k, to_int_id(v))
                else:
                    query = query.eq(k, v)
            res = query.execute()
            saved = res.data[0] if (res.data and len(res.data) > 0) else None
            return self._format_row(table, saved) if saved else self.fetch_one(table, filters)
        except Exception as e:
            logger.error("Supabase update error on %s: %s", table, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"success": False, "error": f"Supabase update error on table '{table}': {str(e)}"},
            )

    def upsert(self, table: str, data: Dict[str, Any], on_conflict: Optional[str] = None) -> Dict[str, Any]:
        client = self._require_client()
        clean = self._sanitize_data(table, data)
        conflict_col = on_conflict
        if not conflict_col:
            if table == "recovery_cases":
                conflict_col = "case_id"
            elif table == "transactions":
                conflict_col = "transaction_id"
            elif table == "customers":
                conflict_col = "id"
        try:
            if conflict_col:
                res = client.table(table).upsert(clean, on_conflict=conflict_col).execute()
            else:
                res = client.table(table).upsert(clean).execute()
            saved = res.data[0] if (res.data and len(res.data) > 0) else clean
            return self._format_row(table, saved)
        except Exception as e:
            logger.error("Supabase upsert error on %s: %s", table, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"success": False, "error": f"Supabase upsert error on table '{table}': {str(e)}"},
            )

db = SupabaseDatabaseManager()
