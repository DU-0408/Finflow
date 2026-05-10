from __future__ import annotations

import os
import logging

import httpx
from dotenv import load_dotenv

from generator.models import Transaction, TransactionStatus
from generator.db     import DatabaseManager
from generator.cache  import CacheManager

load_dotenv()
logger = logging.getLogger(__name__)

FRAUD_SERVICE_URL        = os.getenv("FRAUD_SERVICE_URL",        "http://localhost:8001")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://localhost:8002")


class TransactionPipeline:
    """
    Orchestrates the full transaction processing flow:
    1. Deduplication check (Redis)
    2. Save to PostgreSQL
    3. Fraud analysis (fraud_service)
    4. Alert if suspicious (notification_service)
    5. Update DB with fraud result
    """

    def __init__(self, db: DatabaseManager, cache: CacheManager):
        self.db    = db
        self.cache = cache

    def process(self, tx: Transaction) -> dict:

        # ── Step 1: Deduplication ─────────────────────────────────────────────
        if self.cache.is_duplicate(tx.transaction_id):
            logger.warning(f"Duplicate transaction skipped: {tx.transaction_id}")
            return {
                "transaction_id": tx.transaction_id,
                "status":         "duplicate",
                "message":        "Transaction already processed"
            }

        self.cache.mark_seen(tx.transaction_id)

        # ── Step 2: Save to PostgreSQL ────────────────────────────────────────
        saved = self.db.insert_transaction(tx)
        if not saved:
            logger.error(f"Failed to save transaction: {tx.transaction_id}")
            return {
                "transaction_id": tx.transaction_id,
                "status":         "error",
                "message":        "Database insert failed"
            }

        # ── Step 3: Fraud analysis ────────────────────────────────────────────
        fraud_result = self._call_fraud_service(tx)

        # ── Step 4: Notify if suspicious ──────────────────────────────────────
        if fraud_result and fraud_result.get("is_suspicious"):
            self._call_notification_service(tx, fraud_result)

            # Also log fraud alert to DB
            pattern = (
                fraud_result["triggered_rules"][0]
                if fraud_result.get("triggered_rules")
                else "unknown"
            )
            tx.fraud_score   = fraud_result.get("fraud_score", 0.0)
            tx.is_suspicious = True
            tx.status        = TransactionStatus.FLAGGED
            self.db.insert_fraud_alert(tx, pattern)

        elif tx.is_high_value:
            self._call_high_value_notification(tx)

        # ── Step 5: Return result ─────────────────────────────────────────────
        return {
            "transaction_id": tx.transaction_id,
            "status":         "processed",
            "amount":         tx.amount,
            "currency":       tx.currency,
            "merchant":       tx.merchant_name,
            "fraud_analysis": fraud_result,
        }

    def _call_fraud_service(self, tx: Transaction) -> dict | None:
        try:
            resp = httpx.post(
                f"{FRAUD_SERVICE_URL}/analyze",
                content=tx.model_dump_json(),
                headers={"Content-Type": "application/json"},
                timeout=5.0,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Fraud service call failed: {e}")
            return None

    def _call_notification_service(self, tx: Transaction, fraud_result: dict):
        try:
            payload = {
                "transaction_id":  tx.transaction_id,
                "account_id":      tx.account_id,
                "amount":          tx.amount,
                "fraud_score":     fraud_result.get("fraud_score", 0.0),
                "triggered_rules": fraud_result.get("triggered_rules", []),
                "recommendation":  fraud_result.get("recommendation", "REVIEW"),
                "merchant_name":   tx.merchant_name,
                "channel":         tx.channel,
            }
            httpx.post(
                f"{NOTIFICATION_SERVICE_URL}/alert/fraud",
                json=payload,
                timeout=5.0,
            )
        except Exception as e:
            logger.error(f"Notification service call failed: {e}")

    def _call_high_value_notification(self, tx: Transaction):
        try:
            payload = {
                "transaction_id": tx.transaction_id,
                "account_id":     tx.account_id,
                "amount":         tx.amount,
                "merchant_name":  tx.merchant_name,
                "channel":        tx.channel,
            }
            httpx.post(
                f"{NOTIFICATION_SERVICE_URL}/alert/high-value",
                json=payload,
                timeout=5.0,
            )
        except Exception as e:
            logger.error(f"High-value notification failed: {e}")