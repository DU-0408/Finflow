from __future__ import annotations

import os
import logging

import redis
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

VELOCITY_WINDOW   = 60      # seconds — track transactions per account per minute
VELOCITY_LIMIT    = 10      # flag if account exceeds this many tx in 60s
DEDUP_TTL         = 86400   # 24 hours — remember transaction IDs to prevent duplicates


class CacheManager:

    def __init__(self):
        self.client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            db=int(os.getenv("REDIS_DB", 0)),
            decode_responses=True,
        )

    def ping(self) -> bool:
        try:
            return self.client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {e}")
            return False

    # ── Deduplication ─────────────────────────────────────────────────────────

    def is_duplicate(self, transaction_id: str) -> bool:
        """Returns True if this transaction ID has been seen before."""
        return self.client.exists(f"tx:seen:{transaction_id}") == 1

    def mark_seen(self, transaction_id: str):
        """Mark a transaction ID as processed. Expires after 24 hours."""
        self.client.setex(f"tx:seen:{transaction_id}", DEDUP_TTL, "1")

    # ── Velocity tracking ─────────────────────────────────────────────────────

    def increment_velocity(self, account_id: str) -> int:
        """
        Increment transaction count for this account in the current
        60-second window. Returns the new count.
        """
        key = f"velocity:{account_id}"
        pipe = self.client.pipeline()
        pipe.incr(key)
        pipe.expire(key, VELOCITY_WINDOW)
        results = pipe.execute()
        return results[0]          # the new counter value

    def get_account_velocity(self, account_id: str) -> int:
        """Get how many transactions this account made in the last 60 seconds."""
        val = self.client.get(f"velocity:{account_id}")
        return int(val) if val else 0

    def is_high_velocity(self, account_id: str) -> bool:
        """Returns True if account exceeds velocity limit."""
        return self.get_account_velocity(account_id) > VELOCITY_LIMIT

    # ── Simple key-value store (for misc caching) ─────────────────────────────

    def set(self, key: str, value: str, ttl: int = 300):
        self.client.setex(key, ttl, value)

    def get(self, key: str) -> str | None:
        return self.client.get(key)