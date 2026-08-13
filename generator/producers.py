from __future__ import annotations

import json
import logging
import os

import boto3
import httpx
from dotenv import load_dotenv

from .models import Transaction

load_dotenv()
logger = logging.getLogger(__name__)


class KinesisProducer:
    """Sends transactions to AWS Kinesis Data Streams."""

    def __init__(self):
        self.client      = boto3.client("kinesis", region_name=os.getenv("AWS_DEFAULT_REGION"))
        self.stream_name = os.getenv("KINESIS_STREAM_NAME", "finflow-transactions")

    def send(self, tx: Transaction) -> bool:
        try:
            self.client.put_record(
                StreamName=self.stream_name,
                Data=tx.model_dump_json(),
                PartitionKey=tx.account_id,
            )
            return True
        except Exception as e:
            logger.error(f"Kinesis send failed: {e}")
            return False

    def send_batch(self, transactions: list[Transaction]) -> dict:
        records = [
            {"Data": tx.model_dump_json(), "PartitionKey": tx.account_id}
            for tx in transactions
        ]
        # Kinesis put_records accepts max 500 per call
        results = {"success": 0, "failed": 0}
        for i in range(0, len(records), 500):
            chunk = records[i:i + 500]
            try:
                resp = self.client.put_records(
                    StreamName=self.stream_name,
                    Records=chunk
                )
                results["failed"]  += resp.get("FailedRecordCount", 0)
                results["success"] += len(chunk) - resp.get("FailedRecordCount", 0)
            except Exception as e:
                logger.error(f"Kinesis batch send failed: {e}")
                results["failed"] += len(chunk)
        return results


class APIProducer:
    """Sends transactions to the FastAPI gateway (batch mode)."""

    def __init__(self):
        base = os.getenv("API_GATEWAY_URL", "http://localhost:8000")
        self.url = f"{base}/transactions/batch"

    def send_batch(self, transactions: list[Transaction]) -> bool:
        try:
            payload = [json.loads(tx.model_dump_json()) for tx in transactions]
            resp    = httpx.post(self.url, json=payload, timeout=10)
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"API batch send failed: {e}")
            return False


class LocalProducer:
    """Prints transactions to console — used for local dev and testing."""

    def __init__(self, pretty: bool = True):
        self.pretty = pretty
        self.count  = 0

    def send(self, tx: Transaction) -> bool:
        self.count += 1
        if self.pretty:
            flag = "🚨 FRAUD" if tx.is_suspicious else "✅"
            print(
                f"[{self.count:>5}] {flag} | "
                f"{tx.transaction_type.value:<20} | "
                f"₹{tx.amount:>12,.2f} | "
                f"{tx.merchant_name:<20} | "
                f"{tx.location.city}"
            )
        else:
            print(tx.model_dump_json())
        return True


class DualProducer:
    """Sends transactions to both API Gateway (DB) AND Kinesis (AWS pipeline).

    The API Gateway path is the critical one (populates the dashboard).
    Kinesis failures are logged but don't block the pipeline.
    """

    def __init__(self):
        self.api     = APIProducer()
        self.kinesis = KinesisProducer()
        logger.info("DualProducer initialized — writing to API Gateway + Kinesis")

    def send_batch(self, transactions: list[Transaction]) -> bool:
        # API Gateway is the critical path
        api_ok = self.api.send_batch(transactions)

        # Kinesis is best-effort
        try:
            self.kinesis.send_batch(transactions)
        except Exception as e:
            logger.warning(f"Kinesis dual-write failed (non-fatal): {e}")

        return api_ok

