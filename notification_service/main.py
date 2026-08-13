from __future__ import annotations

import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, generate_latest
from pydantic import BaseModel

from .notifier import get_notifier

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FinFlow Notification Service",
    description="Alert dispatcher for fraudulent and high-value transactions",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

notifier = get_notifier()

# ── Prometheus metrics ────────────────────────────────────────────────────────
ALERTS_SENT_TOTAL   = Counter("alerts_sent_total",        "Total alerts sent", ["alert_type"])
ALERTS_FAILED_TOTAL = Counter("alerts_failed_total",      "Total alerts failed")


# ── Request models ────────────────────────────────────────────────────────────

class FraudAlertRequest(BaseModel):
    transaction_id:  str
    account_id:      str
    amount:          float
    fraud_score:     float
    triggered_rules: list[str]
    recommendation:  str
    merchant_name:   str | None = None
    channel:         str | None = None


class HighValueAlertRequest(BaseModel):
    transaction_id: str
    account_id:     str
    amount:         float
    merchant_name:  str | None = None
    channel:        str | None = None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status":   "ok",
        "service":  "notification_service",
        "notifier": notifier.__class__.__name__,
    }


@app.post("/alert/fraud")
def send_fraud_alert(req: FraudAlertRequest):
    ok = notifier.send_fraud_alert(req.model_dump())
    if ok:
        ALERTS_SENT_TOTAL.labels(alert_type="fraud").inc()
        return {"status": "sent", "transaction_id": req.transaction_id}
    ALERTS_FAILED_TOTAL.inc()
    raise HTTPException(status_code=500, detail="Failed to send fraud alert")


@app.post("/alert/high-value")
def send_high_value_alert(req: HighValueAlertRequest):
    ok = notifier.send_high_value_alert(req.model_dump())
    if ok:
        ALERTS_SENT_TOTAL.labels(alert_type="high_value").inc()
        return {"status": "sent", "transaction_id": req.transaction_id}
    ALERTS_FAILED_TOTAL.inc()
    raise HTTPException(status_code=500, detail="Failed to send high-value alert")


@app.post("/alert/batch")
def send_batch_alerts(requests: list[FraudAlertRequest]):
    """Send multiple fraud alerts at once."""
    if len(requests) > 100:
        raise HTTPException(status_code=422, detail="Max 100 alerts per batch")

    results = {"sent": 0, "failed": 0}
    for req in requests:
        ok = notifier.send_fraud_alert(req.model_dump())
        if ok:
            results["sent"] += 1
            ALERTS_SENT_TOTAL.labels(alert_type="fraud").inc()
        else:
            results["failed"] += 1
            ALERTS_FAILED_TOTAL.inc()

    return results