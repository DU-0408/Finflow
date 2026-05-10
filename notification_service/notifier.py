from __future__ import annotations

import os
import json
import logging
from datetime import datetime

import boto3
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class SNSNotifier:
    """Sends alerts to AWS SNS — used in production."""

    def __init__(self):
        self.client    = boto3.client("sns", region_name=os.getenv("AWS_DEFAULT_REGION", "ap-south-1"))
        self.topic_arn = os.getenv("SNS_ALERT_TOPIC_ARN", "")

    def send_fraud_alert(self, transaction_data: dict) -> bool:
        message = (
            f"🚨 FRAUD ALERT\n"
            f"{'─' * 40}\n"
            f"Transaction ID : {transaction_data.get('transaction_id', 'N/A')}\n"
            f"Account        : {transaction_data.get('account_id', 'N/A')}\n"
            f"Amount         : ₹{transaction_data.get('amount', 0):,.2f}\n"
            f"Fraud Score    : {transaction_data.get('fraud_score', 0):.2f}\n"
            f"Rules Triggered: {', '.join(transaction_data.get('triggered_rules', []))}\n"
            f"Recommendation : {transaction_data.get('recommendation', 'N/A')}\n"
            f"Detected At    : {datetime.utcnow().isoformat()}\n"
        )
        try:
            self.client.publish(
                TopicArn=self.topic_arn,
                Subject="FinFlow Fraud Alert",
                Message=message,
            )
            logger.info(f"SNS fraud alert sent for {transaction_data.get('transaction_id')}")
            return True
        except Exception as e:
            logger.error(f"SNS publish failed: {e}")
            return False

    def send_high_value_alert(self, transaction_data: dict) -> bool:
        message = (
            f"⚠️  HIGH VALUE TRANSACTION\n"
            f"{'─' * 40}\n"
            f"Transaction ID : {transaction_data.get('transaction_id', 'N/A')}\n"
            f"Account        : {transaction_data.get('account_id', 'N/A')}\n"
            f"Amount         : ₹{transaction_data.get('amount', 0):,.2f}\n"
            f"Merchant       : {transaction_data.get('merchant_name', 'N/A')}\n"
            f"Channel        : {transaction_data.get('channel', 'N/A')}\n"
            f"Detected At    : {datetime.utcnow().isoformat()}\n"
        )
        try:
            self.client.publish(
                TopicArn=self.topic_arn,
                Subject="FinFlow High Value Transaction",
                Message=message,
            )
            logger.info(f"SNS high-value alert sent for {transaction_data.get('transaction_id')}")
            return True
        except Exception as e:
            logger.error(f"SNS publish failed: {e}")
            return False


class MockNotifier:
    """
    Logs alerts to console — no AWS needed.
    Controlled by USE_MOCK_NOTIFIER=true in .env
    """

    def send_fraud_alert(self, transaction_data: dict) -> bool:
        logger.warning(
            f"\n{'='*50}\n"
            f"🚨 [MOCK] FRAUD ALERT\n"
            f"  Transaction : {transaction_data.get('transaction_id', 'N/A')[:16]}...\n"
            f"  Account     : {transaction_data.get('account_id', 'N/A')}\n"
            f"  Amount      : ₹{transaction_data.get('amount', 0):,.2f}\n"
            f"  Score       : {transaction_data.get('fraud_score', 0):.2f}\n"
            f"  Rules       : {', '.join(transaction_data.get('triggered_rules', []))}\n"
            f"  Action      : {transaction_data.get('recommendation', 'N/A')}\n"
            f"{'='*50}"
        )
        return True

    def send_high_value_alert(self, transaction_data: dict) -> bool:
        logger.info(
            f"\n{'='*50}\n"
            f"⚠️  [MOCK] HIGH VALUE ALERT\n"
            f"  Transaction : {transaction_data.get('transaction_id', 'N/A')[:16]}...\n"
            f"  Account     : {transaction_data.get('account_id', 'N/A')}\n"
            f"  Amount      : ₹{transaction_data.get('amount', 0):,.2f}\n"
            f"  Merchant    : {transaction_data.get('merchant_name', 'N/A')}\n"
            f"{'='*50}"
        )
        return True


def get_notifier():
    """Factory — returns MockNotifier locally, SNSNotifier in production."""
    use_mock = os.getenv("USE_MOCK_NOTIFIER", "true").lower() == "true"
    if use_mock:
        logger.info("Using MockNotifier (set USE_MOCK_NOTIFIER=false for SNS)")
        return MockNotifier()
    return SNSNotifier()