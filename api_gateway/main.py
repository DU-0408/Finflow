from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
from dotenv import load_dotenv

from generator.models import Transaction
from generator.db     import DatabaseManager
from generator.cache  import CacheManager
from generator.factory import TransactionFactory
from .middleware import LoggingMiddleware
from .pipeline  import TransactionPipeline

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Shared instances ──────────────────────────────────────────────────────────
db      = DatabaseManager()
cache   = CacheManager()
factory = TransactionFactory()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — retry PostgreSQL connection up to 10 times
    import time
    logger.info("Connecting to PostgreSQL and Redis...")
    for attempt in range(10):
        try:
            db.connect()
            db.create_tables()
            logger.info("PostgreSQL connected.")
            break
        except Exception as e:
            logger.warning(f"PostgreSQL not ready (attempt {attempt+1}/10): {e}")
            time.sleep(3)
    else:
        logger.error("Could not connect to PostgreSQL after 10 attempts.")

    logger.info("API Gateway ready.")
    yield
    # Shutdown
    db.disconnect()
    logger.info("API Gateway shut down.")


app = FastAPI(
    title="FinFlow API Gateway",
    description="Single entry point for the FinFlow banking transaction pipeline",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(LoggingMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    # Test PostgreSQL with a live query
    postgres_ok = False
    try:
        db.cursor.execute("SELECT 1")
        postgres_ok = True
    except Exception:
        try:
            db.connect()
            db.cursor.execute("SELECT 1")
            postgres_ok = True
        except Exception:
            postgres_ok = False

    return {
        "status":   "ok",
        "service":  "api_gateway",
        "postgres": postgres_ok,
        "redis":    cache.ping(),
    }


# ── Transactions ──────────────────────────────────────────────────────────────

@app.post("/transactions")
def submit_transaction(tx: Transaction):
    """Submit a single transaction through the full pipeline."""
    pipeline = TransactionPipeline(db, cache)
    result   = pipeline.process(tx)
    return result


@app.post("/transactions/batch")
def submit_batch(transactions: list[Transaction]):
    """Submit a batch of transactions. Max 1000 per call."""
    if len(transactions) > 1000:
        raise HTTPException(status_code=422, detail="Max 1000 transactions per batch")

    pipeline = TransactionPipeline(db, cache)
    results  = {
        "total":     len(transactions),
        "processed": 0,
        "duplicates": 0,
        "errors":    0,
        "flagged":   0,
    }

    for tx in transactions:
        result = pipeline.process(tx)
        if result["status"] == "processed":
            results["processed"] += 1
            fa = result.get("fraud_analysis")
            if fa and fa.get("is_suspicious"):
                results["flagged"] += 1
        elif result["status"] == "duplicate":
            results["duplicates"] += 1
        else:
            results["errors"] += 1

    return results


@app.get("/transactions")
def get_transactions(
    limit:  int = Query(default=50,  ge=1, le=500),
    offset: int = Query(default=0,   ge=0),
):
    """Paginated list of all transactions."""
    rows = db.get_transactions(limit=limit, offset=offset)
    return {
        "limit":        limit,
        "offset":       offset,
        "count":        len(rows),
        "transactions": [dict(r) for r in rows],
    }


@app.get("/transactions/{transaction_id}")
def get_transaction(transaction_id: str):
    """Fetch a single transaction by ID."""
    row = db.get_transaction_by_id(transaction_id)
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return dict(row)


@app.get("/fraud-alerts")
def get_fraud_alerts(limit: int = Query(default=50, ge=1, le=500)):
    """List all fraud alerts."""
    rows = db.get_fraud_alerts(limit=limit)
    return {
        "count":  len(rows),
        "alerts": [dict(r) for r in rows],
    }


@app.get("/stats")
def get_stats():
    """Pipeline statistics from PostgreSQL."""
    return db.get_stats()


# ── Simulation endpoint (for demos) ──────────────────────────────────────────

@app.post("/simulate")
def simulate(
    count:      int   = Query(default=10,   ge=1,   le=500),
    fraud_rate: float = Query(default=0.1,  ge=0.0, le=1.0),
):
    """
    Generate and process synthetic transactions.
    Perfect for demos — no external data source needed.
    """
    sim_factory = TransactionFactory(fraud_rate=fraud_rate)
    pipeline    = TransactionPipeline(db, cache)

    results = {
        "total":     count,
        "processed": 0,
        "flagged":   0,
        "errors":    0,
    }

    for _ in range(count):
        tx     = sim_factory.generate()
        result = pipeline.process(tx)

        if result["status"] == "processed":
            results["processed"] += 1
            fa = result.get("fraud_analysis")
            if fa and fa.get("is_suspicious"):
                results["flagged"] += 1
        else:
            results["errors"] += 1

    results["fraud_rate_actual"] = (
        round(results["flagged"] / results["processed"] * 100, 1)
        if results["processed"] > 0 else 0
    )

    return results