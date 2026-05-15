from __future__ import annotations

import logging
from dataclasses import dataclass

from generator.models import Transaction, MerchantCategory

logger = logging.getLogger(__name__)

VELOCITY_LIMIT    = 10       # transactions per 60 seconds
HIGH_VALUE_INR    = 100_000  # ₹1,00,000
CARD_TEST_LIMIT   = 50       # amounts below this + ONLINE = card testing
ODD_HOURS_START   = 1        # 1am
ODD_HOURS_END     = 4        # 4am


@dataclass
class RuleResult:
    rule_name:   str
    triggered:   bool
    score:       float          # 0.0 = clean, 1.0 = definitely fraud
    reason:      str


class FraudRuleEngine:
    """
    Runs a transaction through all fraud rules.
    Returns the highest score found and all triggered rules.
    """

    def check_high_value(self, tx: Transaction) -> RuleResult:
        triggered = tx.amount > HIGH_VALUE_INR
        return RuleResult(
            rule_name="high_value",
            triggered=triggered,
            score=0.70 if triggered else 0.0,
            reason=f"Amount ₹{tx.amount:,.2f} exceeds threshold ₹{HIGH_VALUE_INR:,}" if triggered else "",
        )

    def check_geo_anomaly(self, tx: Transaction) -> RuleResult:
        HIGH_RISK_COUNTRIES = {"Nigeria", "Romania", "Ukraine", "Belarus", "North Korea"}
        triggered = tx.location.country in HIGH_RISK_COUNTRIES or (
            tx.is_international and tx.account_type == "SAVINGS"
        )
        return RuleResult(
            rule_name="geo_anomaly",
            triggered=triggered,
            score=0.85 if triggered else 0.0,
            reason=f"Transaction from high-risk location: {tx.location.country}" if triggered else "",
        )

    def check_card_testing(self, tx: Transaction) -> RuleResult:
        triggered = (
            tx.amount < CARD_TEST_LIMIT
            and tx.channel == "ONLINE"
            and tx.merchant_category == MerchantCategory.ONLINE
        )
        return RuleResult(
            rule_name="card_testing",
            triggered=triggered,
            score=0.85 if triggered else 0.0,
            reason=f"Possible card testing: ₹{tx.amount} online purchase" if triggered else "",
        )

    def check_odd_hours(self, tx: Transaction) -> RuleResult:
        hour      = tx.timestamp.hour
        triggered = ODD_HOURS_START <= hour < ODD_HOURS_END
        return RuleResult(
            rule_name="odd_hours",
            triggered=triggered,
            score=0.30 if triggered else 0.0,
            reason=f"Transaction at unusual hour: {hour:02d}:00" if triggered else "",
        )

    def check_international_high_amount(self, tx: Transaction) -> RuleResult:
        triggered = tx.is_international and tx.amount > 50_000
        return RuleResult(
            rule_name="international_high_amount",
            triggered=triggered,
            score=0.75 if triggered else 0.0,
            reason=f"High-value international transaction: {tx.currency} {tx.amount:,.2f}" if triggered else "",
        )

    def check_refund_abuse(self, tx: Transaction) -> RuleResult:
        from generator.models import TransactionType
        triggered = (
            tx.transaction_type == TransactionType.REFUND
            and tx.amount > 10_000
        )
        return RuleResult(
            rule_name="refund_abuse",
            triggered=triggered,
            score=0.60 if triggered else 0.0,
            reason=f"Large refund detected: ₹{tx.amount:,.2f}" if triggered else "",
        )

    def analyze(self, tx: Transaction, velocity: int = 0) -> dict:
        """
        Run all rules. Return enriched transaction data with fraud assessment.
        """
        # Velocity rule needs external input (from Redis via the service layer)
        velocity_triggered = velocity > VELOCITY_LIMIT
        velocity_result = RuleResult(
            rule_name="velocity",
            triggered=velocity_triggered,
            score=0.90 if velocity_triggered else 0.0,
            reason=f"Account made {velocity} transactions in last 60s" if velocity_triggered else "",
        )

        all_results = [
            self.check_high_value(tx),
            self.check_geo_anomaly(tx),
            self.check_card_testing(tx),
            self.check_odd_hours(tx),
            self.check_international_high_amount(tx),
            self.check_refund_abuse(tx),
            velocity_result,
        ]

        triggered_rules = [r for r in all_results if r.triggered]
        fraud_score     = max((r.score for r in all_results), default=0.0)
        is_fraud        = fraud_score >= 0.50

        return {
            "transaction_id":   tx.transaction_id,
            "fraud_score":      round(fraud_score, 3),
            "is_suspicious":    is_fraud,
            "triggered_rules":  [r.rule_name for r in triggered_rules],
            "reasons":          [r.reason    for r in triggered_rules],
            "recommendation":   "BLOCK"  if fraud_score >= 0.80
                                else "REVIEW" if fraud_score >= 0.50
                                else "APPROVE",
        }