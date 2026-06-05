from __future__ import annotations

import os
import logging
import threading

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

from .models import Transaction

load_dotenv()
logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Thread-safe database manager.

    Write operations (insert/update) use a dedicated cursor protected by a lock.
    Read operations (get_*) create a fresh cursor per call so they never
    collide with writes or with each other.
    """

    def __init__(self):
        self.conn   = None
        self._write_cursor = None
        self._write_lock = threading.Lock()

    def connect(self):
        try:
            self.conn = psycopg2.connect(
                host=os.getenv("POSTGRES_HOST", "localhost"),
                port=int(os.getenv("POSTGRES_PORT", 5432)),
                dbname=os.getenv("POSTGRES_DB", "finflow"),
                user=os.getenv("POSTGRES_USER", "finflow_user"),
                password=os.getenv("POSTGRES_PASSWORD", "changeme"),
                connect_timeout=3,
            )
            self.conn.autocommit = True
            self._write_cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            logger.info("PostgreSQL connected.")
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            raise

    # ── Backward compat — some callers access .cursor directly ──────────
    @property
    def cursor(self):
        return self._write_cursor

    def disconnect(self):
        if self._write_cursor:
            self._write_cursor.close()
        if self.conn:
            self.conn.close()
        logger.info("PostgreSQL disconnected.")

    def _read_cursor(self):
        """Create a fresh cursor for read-only queries (thread-safe)."""
        return self.conn.cursor(cursor_factory=RealDictCursor)

    def create_tables(self):
        """Create all tables if they don't exist."""

        self._write_cursor.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                account_id      VARCHAR(20)  PRIMARY KEY,
                account_number  VARCHAR(25)  NOT NULL,
                account_type    VARCHAR(10)  NOT NULL,
                home_city       VARCHAR(50),
                risk_profile    VARCHAR(10)  DEFAULT 'LOW',
                created_at      TIMESTAMP    DEFAULT NOW()
            );
        """)

        self._write_cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id      UUID         PRIMARY KEY,
                timestamp           TIMESTAMP    NOT NULL,
                account_id          VARCHAR(20)  NOT NULL,
                account_number      VARCHAR(25)  NOT NULL,
                account_type        VARCHAR(10)  NOT NULL,
                transaction_type    VARCHAR(25)  NOT NULL,
                amount              NUMERIC(15,2) NOT NULL,
                currency            VARCHAR(5)   NOT NULL,
                status              VARCHAR(10)  NOT NULL,
                merchant_id         VARCHAR(20),
                merchant_name       VARCHAR(100),
                merchant_category   VARCHAR(25),
                location_country    VARCHAR(50),
                location_city       VARCHAR(50),
                location_lat        NUMERIC(10,6),
                location_lon        NUMERIC(10,6),
                channel             VARCHAR(10),
                is_international    BOOLEAN      DEFAULT FALSE,
                is_high_value       BOOLEAN      DEFAULT FALSE,
                is_suspicious       BOOLEAN      DEFAULT FALSE,
                fraud_score         NUMERIC(4,3),
                device_fingerprint  VARCHAR(64),
                ip_address          VARCHAR(45),
                created_at          TIMESTAMP    DEFAULT NOW()
            );
        """)

        self._write_cursor.execute("""
            CREATE TABLE IF NOT EXISTS fraud_alerts (
                id              SERIAL       PRIMARY KEY,
                transaction_id  UUID         NOT NULL,
                account_id      VARCHAR(20)  NOT NULL,
                amount          NUMERIC(15,2),
                fraud_score     NUMERIC(4,3),
                pattern         VARCHAR(50),
                detected_at     TIMESTAMP    DEFAULT NOW(),
                resolved        BOOLEAN      DEFAULT FALSE,
                resolved_at     TIMESTAMP
            );
        """)

        # Indexes for common queries
        self._write_cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_transactions_account
                ON transactions(account_id);
        """)
        self._write_cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_transactions_timestamp
                ON transactions(timestamp DESC);
        """)
        self._write_cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_transactions_suspicious
                ON transactions(is_suspicious) WHERE is_suspicious = TRUE;
        """)

        self._write_cursor.execute("""
            CREATE TABLE IF NOT EXISTS dashboard_users (
                id            SERIAL       PRIMARY KEY,
                username      VARCHAR(50)  UNIQUE NOT NULL,
                password_hash VARCHAR(128) NOT NULL,
                role          VARCHAR(20)  DEFAULT 'viewer',
                created_at    TIMESTAMP    DEFAULT NOW()
            );
        """)

        logger.info("Tables created successfully.")

    # ── Write operations (use shared cursor with lock) ────────────────────

    def insert_transaction(self, tx: Transaction) -> bool:
        try:
            with self._write_lock:
                self._write_cursor.execute("""
                    INSERT INTO transactions (
                        transaction_id, timestamp, account_id, account_number,
                        account_type, transaction_type, amount, currency, status,
                        merchant_id, merchant_name, merchant_category,
                        location_country, location_city, location_lat, location_lon,
                        channel, is_international, is_high_value, is_suspicious,
                        fraud_score, device_fingerprint, ip_address
                    ) VALUES (
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    )
                    ON CONFLICT (transaction_id) DO NOTHING;
                """, (
                    tx.transaction_id, tx.timestamp, tx.account_id, tx.account_number,
                    tx.account_type, tx.transaction_type.value, tx.amount, tx.currency,
                    tx.status.value, tx.merchant_id, tx.merchant_name,
                    tx.merchant_category.value, tx.location.country, tx.location.city,
                    tx.location.latitude, tx.location.longitude, tx.channel,
                    tx.is_international, tx.is_high_value, tx.is_suspicious,
                    tx.fraud_score, tx.device_fingerprint, tx.ip_address,
                ))
            return True
        except Exception as e:
            logger.error(f"Insert transaction failed: {e}")
            return False

    def insert_fraud_alert(self, tx: Transaction, pattern: str) -> bool:
        try:
            with self._write_lock:
                self._write_cursor.execute("""
                    INSERT INTO fraud_alerts
                        (transaction_id, account_id, amount, fraud_score, pattern)
                    VALUES (%s, %s, %s, %s, %s);
                """, (tx.transaction_id, tx.account_id, tx.amount, tx.fraud_score, pattern))
            return True
        except Exception as e:
            logger.error(f"Insert fraud alert failed: {e}")
            return False

    def update_transaction_status(self, transaction_id: str, status: str,
                                   is_suspicious: bool = False, fraud_score: float = 0.0) -> bool:
        """Update a transaction's status after pipeline processing."""
        try:
            with self._write_lock:
                self._write_cursor.execute("""
                    UPDATE transactions
                    SET status = %s, is_suspicious = %s, fraud_score = %s
                    WHERE transaction_id = %s;
                """, (status, is_suspicious, fraud_score, transaction_id))
            return True
        except Exception as e:
            logger.error(f"Update transaction status failed: {e}")
            return False

    # ── Read operations (use fresh cursor per call — thread-safe) ─────────

    def get_transactions(self, limit: int = 50, offset: int = 0) -> list[dict]:
        cur = self._read_cursor()
        try:
            cur.execute("""
                SELECT * FROM transactions
                ORDER BY timestamp DESC
                LIMIT %s OFFSET %s;
            """, (limit, offset))
            return cur.fetchall()
        finally:
            cur.close()

    def get_transaction_count(self) -> int:
        """Return the total number of transactions."""
        cur = self._read_cursor()
        try:
            cur.execute("SELECT COUNT(*) AS total FROM transactions;")
            return cur.fetchone()["total"]
        finally:
            cur.close()

    def get_transaction_by_id(self, transaction_id: str) -> dict | None:
        cur = self._read_cursor()
        try:
            cur.execute("""
                SELECT * FROM transactions WHERE transaction_id = %s;
            """, (transaction_id,))
            return cur.fetchone()
        finally:
            cur.close()

    def get_fraud_alerts(self, limit: int = 50) -> list[dict]:
        cur = self._read_cursor()
        try:
            cur.execute("""
                SELECT * FROM fraud_alerts
                ORDER BY detected_at DESC
                LIMIT %s;
            """, (limit,))
            return cur.fetchall()
        finally:
            cur.close()

    def get_stats(self) -> dict:
        cur = self._read_cursor()
        try:
            cur.execute("""
                SELECT
                    COUNT(*)                                         AS total,
                    COUNT(*) FILTER (WHERE is_suspicious = TRUE)    AS fraud_count,
                    COUNT(*) FILTER (WHERE is_high_value = TRUE)    AS high_value_count,
                    ROUND(AVG(amount)::numeric, 2)                  AS avg_amount,
                    MAX(amount)                                      AS max_amount,
                    SUM(amount)                                      AS total_volume
                FROM transactions;
            """)
            return dict(cur.fetchone())
        finally:
            cur.close()

    def verify_user(self, username: str) -> dict | None:
        cur = self._read_cursor()
        try:
            cur.execute("""
                SELECT id, username, password_hash, role
                FROM dashboard_users WHERE username = %s;
            """, (username,))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            cur.close()

    def create_user(self, username: str, password_hash: str, role: str = "admin") -> bool:
        try:
            with self._write_lock:
                self._write_cursor.execute("""
                    INSERT INTO dashboard_users (username, password_hash, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (username) DO NOTHING;
                """, (username, password_hash, role))
            return True
        except Exception as e:
            logger.error(f"Create user failed: {e}")
            return False