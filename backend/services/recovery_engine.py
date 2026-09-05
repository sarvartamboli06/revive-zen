"""Explainable AI Recovery Decision Engine and Safety Guardrails.

Rules:
1. If attempts >= 3:
   decision = Stop Recovery
   status = stopped
   recovery_probability = 20
   reason = maximum recovery attempts reached
2. If amount > 50,000:
   decision = Human Review
   action = escalate
   status = escalated
   reason = high-value transaction requires human approval
3. If failure_reason is network_error, bank_server_error, payment_timeout:
   recovery_probability = 82
   action = payment_link
   decision = Generate Payment Link
   priority = High
4. If failure_reason is insufficient_funds:
   recovery_probability = 70
   action = retry
   decision = Retry Later
   priority = Medium
5. If checkout was abandoned:
   recovery_probability = 75
   action = payment_link
   decision = Send Payment Recovery Link
   priority = Medium
6. Otherwise:
   recovery_probability = 60
   action = payment_link
   decision = Generate Payment Link
   priority = Medium
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple
from backend.config import settings

logger = logging.getLogger("recoverai.recovery_engine")

MAX_ATTEMPTS = settings.MAX_ATTEMPTS
MAX_CONTACTS = settings.MAX_CONTACTS
HIGH_VALUE_THRESHOLD = settings.HIGH_VALUE_THRESHOLD
RECOVERY_WINDOW_HOURS = settings.RECOVERY_WINDOW_HOURS

class RecoveryEngine:
    MAX_ATTEMPTS = MAX_ATTEMPTS
    MAX_CONTACTS = MAX_CONTACTS
    HIGH_VALUE_THRESHOLD = HIGH_VALUE_THRESHOLD
    RECOVERY_WINDOW_HOURS = RECOVERY_WINDOW_HOURS

    @staticmethod
    def evaluate_case(case: Dict[str, Any], customer: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Analyze a recovery case using explainable, rule-based AI reasoning."""
        attempts = case.get("attempts", 0)
        amount = float(case.get("amount", 0))
        failure_reason = str(case.get("failure_reason", "") or "").lower()
        problem_type = str(case.get("problem_type", "") or "").lower()

        # Rule 1: Max attempts reached
        if attempts >= MAX_ATTEMPTS:
            return {
                "probability": 20,
                "priority": "Low",
                "decision": "Stop Recovery",
                "recommended_action": "stop",
                "reason": "maximum recovery attempts reached",
                "status": "Stopped",
            }

        # Rule 2: High value transaction requiring human review
        if amount > HIGH_VALUE_THRESHOLD:
            return {
                "probability": 50,
                "priority": "Critical" if amount > 100000 else "High",
                "decision": "Human Review",
                "recommended_action": "escalate",
                "reason": "high-value transaction requires human approval",
                "status": "Escalated",
            }

        # Rule 3: Temporary network/bank server/timeout failures
        transient_errors = ["network_error", "bank_server_error", "payment_timeout", "timeout", "network", "bank server"]
        if any(err in failure_reason for err in transient_errors):
            return {
                "probability": 82,
                "priority": "High",
                "decision": "Generate Payment Link",
                "recommended_action": "payment_link",
                "reason": "The payment failure appears temporary and the transaction is within the automated recovery limit.",
                "status": "Analyzed",
            }

        # Rule 4: Insufficient funds
        if "insufficient" in failure_reason or "funds" in failure_reason:
            return {
                "probability": 70,
                "priority": "Medium",
                "decision": "Retry Later",
                "recommended_action": "retry",
                "reason": "Payment failed due to insufficient funds. Scheduled retry or backup payment method recommended.",
                "status": "Analyzed",
            }

        # Rule 5: Checkout abandonment
        if "abandon" in problem_type or "abandon" in failure_reason:
            return {
                "probability": 75,
                "priority": "Medium",
                "decision": "Send Payment Recovery Link",
                "recommended_action": "payment_link",
                "reason": "Checkout was abandoned before completion. Gentle reminder and fast-checkout recovery link recommended.",
                "status": "Analyzed",
            }

        # Rule 6: Default fallback
        return {
            "probability": 60,
            "priority": "Medium",
            "decision": "Generate Payment Link",
            "recommended_action": "payment_link",
            "reason": "Standard payment failure detected. Recommended issuing a smart payment recovery link.",
            "status": "Analyzed",
        }

    @staticmethod
    def validate_guardrails(case: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate safety guardrails before executing any recovery action.

        Returns (allowed, blocking_reason).
        """
        status = str(case.get("status", "")).strip().capitalize()
        if status == "Recovered":
            return False, "Payment already recovered"

        if status == "Stopped":
            return False, "Recovery was stopped for this case"

        attempts = int(case.get("attempts", 0))
        if attempts >= MAX_ATTEMPTS:
            return False, "Maximum recovery attempts reached"

        contacts = int(case.get("contacts", 0))
        if contacts >= MAX_CONTACTS:
            return False, "Maximum customer contacts reached"

        amount = float(case.get("amount", 0))
        if amount > HIGH_VALUE_THRESHOLD:
            return False, "High-value transaction requires human approval"

        created_at_str = case.get("created_at")
        if created_at_str:
            try:
                # Parse created_at to check 24-hour window
                clean_time = created_at_str.replace("Z", "+00:00")
                if "T" in clean_time:
                    created_at = datetime.fromisoformat(clean_time)
                else:
                    created_at = datetime.strptime(clean_time, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                
                now = datetime.now(timezone.utc)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)

                hours_elapsed = (now - created_at).total_seconds() / 3600.0
                if hours_elapsed > RECOVERY_WINDOW_HOURS:
                    return False, f"Recovery window of {RECOVERY_WINDOW_HOURS} hours has expired"
            except Exception as e:
                logger.debug("Date parsing skipped: %s", e)

        return True, None

recovery_engine = RecoveryEngine()
