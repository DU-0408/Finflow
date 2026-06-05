from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
import bcrypt
import os

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


# ── WebSocket connection manager ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WebSocket client connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info(f"WebSocket client disconnected. Total: {len(self.active)}")

    async def broadcast(self, data: dict):
        for ws in self.active[:]:
            try:
                await ws.send_json(data)
            except Exception:
                self.active.remove(ws)

ws_manager = ConnectionManager()


# ── Auth request model ────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    username: str
    password: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — retry PostgreSQL connection up to 10 times
    import time
    logger.info("Connecting to PostgreSQL and Redis...")
    for attempt in range(10):
        try:
            db.connect()
            db.create_tables()
            # Seed admin user from env vars (idempotent)
            admin_user = os.getenv("ADMIN_USERNAME", "admin")
            admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
            pw_hash = bcrypt.hashpw(admin_pass.encode(), bcrypt.gensalt()).decode()
            db.create_user(admin_user, pw_hash, "admin")
            logger.info(f"Admin user '{admin_user}' seeded.")
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
def health(response: Response):
    postgres_ok = db.ping()
    redis_ok = cache.ping()

    if not postgres_ok or not redis_ok:
        response.status_code = 503

    return {
        "status":   "ok" if postgres_ok and redis_ok else "error",
        "service":  "api_gateway",
        "postgres": postgres_ok,
        "redis":    redis_ok,
    }


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/transactions")
async def websocket_transactions(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/verify")
def verify_credentials(req: AuthRequest):
    """Verify dashboard login credentials."""
    user = db.verify_user(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(req.password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "id":       user["id"],
        "username": user["username"],
        "role":     user["role"],
    }


# ── Transactions ──────────────────────────────────────────────────────────────

@app.post("/transactions")
async def submit_transaction(tx: Transaction):
    """Submit a single transaction through the full pipeline."""
    pipeline = TransactionPipeline(db, cache)
    result   = pipeline.process(tx)
    await ws_manager.broadcast(result)
    return result


@app.post("/transactions/batch")
async def submit_batch(transactions: list[Transaction]):
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
        await ws_manager.broadcast(result)
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
    rows  = db.get_transactions(limit=limit, offset=offset)
    total = db.get_transaction_count()
    return {
        "limit":        limit,
        "offset":       offset,
        "count":        len(rows),
        "total":        total,
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
async def simulate(
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
        await ws_manager.broadcast(result)

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