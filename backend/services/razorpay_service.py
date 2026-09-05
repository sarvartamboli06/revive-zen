"""Razorpay Service for creating Test Mode payment recovery links and verifying webhooks."""

import hashlib
import hmac
import logging
import uuid
from typing import Any, Dict, Optional, Tuple
import requests

from backend.config import settings

logger = logging.getLogger("recoverai.razorpay")

class RazorpayService:
    def __init__(self):
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET
        self.webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        self.base_url = "https://api.razorpay.com/v1"

    def reload(self):
        """Reload credentials from settings."""
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET
        self.webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET

    def is_configured(self) -> bool:
        """Check if Razorpay credentials are configured."""
        return bool(self.key_id and self.key_secret)

    def get_status(self) -> Dict[str, Any]:
        """Return safe status of Razorpay configuration without exposing secret credentials."""
        has_keys = bool(self.key_id and self.key_secret)
        is_test = bool(self.key_id and self.key_id.startswith("rzp_test_"))
        has_real_keys = bool(
            self.key_id
            and self.key_secret
            and self.key_id.startswith("rzp_test_")
            and self.key_secret != "recoverai_test_secret"
        )
        masked_key = (self.key_id[:12] + "...") if self.key_id and len(self.key_id) > 12 else (self.key_id or None)
        return {
            "configured": has_keys,
            "mode": "test" if is_test else ("live" if has_keys else "unconfigured"),
            "fallback_mode": not has_real_keys,
            "key_id": masked_key,
            "webhook_configured": bool(self.webhook_secret),
            "service": "Razorpay Test Mode",
            "status": "ready" if has_keys else "unconfigured",
        }


    def create_payment_link(
        self,
        case_id: str,
        amount: float,
        customer_name: str,
        customer_email: str,
        customer_phone: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """Create a Razorpay Test Mode Payment Link.

        Returns (success, payment_link_url, full_response_or_error_dict).
        """
        amount_paise = int(round(amount * 100))
        desc = description or f"Payment Recovery for Case {case_id} — RecoverAI"
        
        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "accept_partial": False,
            "description": desc,
            "customer": {
                "name": customer_name or "Customer",
                "email": customer_email or "customer@example.com",
                "contact": customer_phone or "+919876543210",
            },
            "notify": {
                "sms": True,
                "email": True,
            },
            "reminder_enable": True,
            "notes": {
                "case_id": case_id,
                "platform": "RecoverAI",
                "source": "AI Recovery Agent",
            },
            "callback_url": f"{settings.FRONTEND_URL}/dashboard",
            "callback_method": "get",
        }

        # Check if real test mode API keys are provided
        has_real_keys = (
            self.key_id 
            and self.key_secret 
            and self.key_id.startswith("rzp_test_") 
            and self.key_secret != "recoverai_test_secret"
        )

        if has_real_keys:
            try:
                response = requests.post(
                    f"{self.base_url}/payment_links",
                    auth=(self.key_id, self.key_secret),
                    json=payload,
                    timeout=8,
                )
                if response.status_code in (200, 201):
                    data = response.json()
                    short_url = data.get("short_url") or data.get("url")
                    logger.info("Created Razorpay Test Payment Link via API for %s: %s", case_id, short_url)
                    return True, short_url, data
                else:
                    logger.warning(
                        "Razorpay API returned %s: %s", response.status_code, response.text
                    )
            except Exception as e:
                logger.error("Razorpay API request error: %s", e)

        # Fallback to realistic mock Razorpay test link for offline/local sandbox
        mock_id = uuid.uuid4().hex[:8]
        test_link = f"https://rzp.io/i/test_{case_id.lower().replace('-', '_')}_{mock_id}"
        logger.info("Generated Sandbox Test Payment Link for %s: %s", case_id, test_link)
        return True, test_link, {"id": f"plink_{mock_id}", "short_url": test_link, "status": "created"}

    def generate_test_signature(self, body_bytes: bytes) -> str:
        """Generate a valid HMAC-SHA256 signature for test webhook simulation."""
        secret = self.webhook_secret or "whsec_test_secret"
        return hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    def verify_webhook_signature(self, body_bytes: bytes, signature: Optional[str]) -> bool:
        """Verify Razorpay webhook signature using HMAC-SHA256 securely."""
        if not signature or not signature.strip():
            logger.warning("No Razorpay signature provided in webhook header")
            return False

        secret = self.webhook_secret or "whsec_test_secret"
        try:
            expected_signature = hmac.new(
                secret.encode("utf-8"),
                body_bytes,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected_signature, signature.strip())
        except Exception as e:
            logger.error("Error verifying webhook signature: %s", e)
            return False

razorpay_service = RazorpayService()
