from __future__ import annotations

import os
import time
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
from dotenv import load_dotenv

from generator.models import Transaction
from generator.cache  import CacheManager
from .rules   import FraudRuleEngine
from .metrics import (
    FRAUD_CHECKS_TOTAL, FRAUD_DETECTED_TOTAL,
    RULE_TRIGGER_COUNT, ANALYSIS_DURATION
)

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FinFlow Fraud Detection Service",
    description="Rule-based fraud detection microservice for banking transactions",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Prometheus metrics at /metrics
@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Shared instances
engine = FraudRuleEngine()
cache  = CacheManager()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":  "ok",
        "service": "fraud_service",
        "redis":   cache.ping(),
    }


@app.post("/analyze")
def analyze_transaction(tx: Transaction):
    """
    Analyze a single transaction for fraud.
    Returns fraud score, triggered rules, and recommendation.
    """
    start = time.time()

    try:
        # Get velocity from Redis
        velocity = cache.get_account_velocity(tx.account_id)

        # Run fraud rules
        result = engine.analyze(tx, velocity=velocity)

        # Update Redis velocity counter
        cache.increment_velocity(tx.account_id)

        # Update Prometheus metrics
        FRAUD_CHECKS_TOTAL.inc()
        if result["is_suspicious"]:
            FRAUD_DETECTED_TOTAL.inc()

        for rule in result["triggered_rules"]:
            RULE_TRIGGER_COUNT.labels(rule_name=rule).inc()

        ANALYSIS_DURATION.observe(time.time() - start)

        logger.info(
            f"Analyzed {tx.transaction_id[:8]}... | "
            f"score={result['fraud_score']} | "
            f"recommendation={result['recommendation']}"
        )

        return result

    except Exception as e:
        logger.error(f"Analysis failed for {tx.transaction_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/batch")
def analyze_batch(transactions: list[Transaction]):
    """Analyze a batch of transactions. Max 500 per call."""
    if len(transactions) > 500:
        raise HTTPException(status_code=400, detail="Max 500 transactions per batch")

    results = []
    for tx in transactions:
        velocity = cache.get_account_velocity(tx.account_id)
        result   = engine.analyze(tx, velocity=velocity)
        cache.increment_velocity(tx.account_id)
        FRAUD_CHECKS_TOTAL.inc()
        if result["is_suspicious"]:
            FRAUD_DETECTED_TOTAL.inc()
        for rule in result["triggered_rules"]:
            RULE_TRIGGER_COUNT.labels(rule_name=rule).inc()
        results.append(result)

    return {
        "total":     len(results),
        "flagged":   sum(1 for r in results if r["is_suspicious"]),
        "results":   results,
    }


@app.get("/stats")
def get_stats():
    """Return current fraud detection stats from Prometheus counters."""
    return {
        "service": "fraud_service",
        "note":    "See /metrics for full Prometheus data"
    }