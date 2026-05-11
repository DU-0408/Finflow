"""
AWS Lambda function — triggered by Kinesis Data Stream.
Reads transaction records, validates them, writes to S3 data lake.
"""

import json
import os
import base64
import logging
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3  = boto3.client("s3")
sns = boto3.client("sns")

S3_BUCKET     = os.environ.get("S3_BUCKET_NAME", "")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN",  "")


def lambda_handler(event, context):
    """
    Processes a batch of Kinesis records.
    Each record is a transaction JSON from the generator.
    """
    processed = 0
    errors    = 0
    flagged   = 0

    records_to_save = []

    for record in event.get("Records", []):
        try:
            # Kinesis data is base64-encoded
            raw  = base64.b64decode(record["kinesis"]["data"]).decode("utf-8")
            data = json.loads(raw)

            # Basic validation
            required = ["transaction_id", "amount", "account_id", "timestamp"]
            if not all(k in data for k in required):
                logger.warning(f"Invalid record missing fields: {data.keys()}")
                errors += 1
                continue

            # Normalise timestamp
            data["processed_at"] = datetime.now(timezone.utc).isoformat()
            data["source"]       = "kinesis"

            records_to_save.append(data)
            processed += 1

            if data.get("is_suspicious"):
                flagged += 1

        except Exception as e:
            logger.error(f"Failed to process record: {e}")
            errors += 1

    # Write batch to S3 as newline-delimited JSON
    if records_to_save:
        _write_to_s3(records_to_save)

    logger.info(f"Processed={processed} Flagged={flagged} Errors={errors}")

    return {
        "statusCode": 200,
        "processed":  processed,
        "flagged":    flagged,
        "errors":     errors,
    }


def _write_to_s3(records: list[dict]):
    """Write records to S3 partitioned by date."""
    now  = datetime.now(timezone.utc)
    key  = (
        f"transactions/"
        f"year={now.year}/"
        f"month={now.month:02d}/"
        f"day={now.day:02d}/"
        f"{now.strftime('%H-%M-%S-%f')}.json"
    )
    body = "\n".join(json.dumps(r) for r in records)

    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=body.encode("utf-8"),
            ContentType="application/json",
        )
        logger.info(f"Wrote {len(records)} records to s3://{S3_BUCKET}/{key}")
    except Exception as e:
        logger.error(f"S3 write failed: {e}")
        raise