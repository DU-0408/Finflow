"""
Shared fixtures for FinFlow test suite.
Uses real PostgreSQL (finflow_test database) and real Redis (DB 1).
"""
import os
import pytest
import psycopg2
import redis as redis_lib
from fastapi.testclient import TestClient

# ── Environment overrides for test isolation ──────────────────────────────────
os.environ["POSTGRES_DB"]   = "finflow_test"
os.environ["REDIS_DB"]      = "1"
os.environ["USE_MOCK_NOTIFIER"] = "true"

# ── PostgreSQL ────────────────────────────────────────────────────────────────

def _pg_conn(dbname="postgres"):
    return psycopg2.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=os.environ.get("POSTGRES_PORT", "5432"),
        user=os.environ.get("POSTGRES_USER", "finflow"),
        password=os.environ.get("POSTGRES_PASSWORD", "finflow"),
        dbname=dbname,
    )


@pytest.fixture(scope="session", autouse=True)
def create_test_database():
    """Create finflow_test DB before session, drop it after."""
    conn = _pg_conn("postgres")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DROP DATABASE IF EXISTS finflow_test")
    cur.execute("CREATE DATABASE finflow_test")
    cur.close()
    conn.close()

    # Run schema creation via the app's own db layer
    from generator.db import DatabaseManager
    db = DatabaseManager()
    db.connect()
    db.create_tables()
    db.disconnect()

    yield

    conn = _pg_conn("postgres")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("DROP DATABASE IF EXISTS finflow_test")
    cur.close()
    conn.close()


@pytest.fixture
def db():
    """Fresh Database instance per test, clears tables before each test."""
    from generator.db import DatabaseManager
    database = DatabaseManager()
    database.connect()

    cur = database.conn.cursor()
    cur.execute("TRUNCATE TABLE fraud_alerts, transactions RESTART IDENTITY CASCADE")
    database.conn.commit()
    cur.close()

    yield database
    database.disconnect()


# ── Redis ─────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def flush_test_redis():
    """Flush Redis DB 1 before and after the test session."""
    r = redis_lib.Redis(
        host=os.environ.get("REDIS_HOST", "localhost"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=1,
    )
    r.flushdb()
    yield
    r.flushdb()


@pytest.fixture
def redis_client():
    """Fresh Redis client pointing at DB 1, flushed before each test."""
    r = redis_lib.Redis(
        host=os.environ.get("REDIS_HOST", "localhost"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=1,
    )
    r.flushdb()
    yield r
    r.flushdb()


# ── App clients ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def api_client():
    from api_gateway.main import app
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="module")
def fraud_client():
    from fraud_service.main import app
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="module")
def notification_client():
    from notification_service.main import app
    with TestClient(app) as client:
        yield client


# ── Shared data helpers ───────────────────────────────────────────────────────

@pytest.fixture
def transaction_factory():
    from generator.factory import TransactionFactory
    return TransactionFactory(fraud_rate=0.0)


@pytest.fixture
def sample_transaction(transaction_factory):
    return transaction_factory.generate()


@pytest.fixture
def fraud_transaction():
    from generator.factory import TransactionFactory
    return TransactionFactory(fraud_rate=1.0).generate(force_fraud=True)