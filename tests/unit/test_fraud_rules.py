"""Unit tests for all 7 fraud detection rules."""
import pytest
from unittest.mock import patch, MagicMock
from generator.factory import TransactionFactory
from fraud_service.rules import FraudRuleEngine


@pytest.fixture
def engine():
    return FraudRuleEngine()


@pytest.fixture
def base_tx():
    """A clean, non-fraudulent transaction."""
    return TransactionFactory(fraud_rate=0.0).generate()


@pytest.mark.unit
class TestHighValueRule:
    def test_high_value_triggers_above_threshold(self, engine, base_tx):
        base_tx.amount = 150000.0
        result = engine.check_high_value(base_tx)

        assert result.score == 0.70

    def test_high_value_no_trigger_below_threshold(self, engine, base_tx):
        base_tx.amount = 50000.0
        result = engine.check_high_value(base_tx)

        assert result.score == 0.0

    def test_high_value_exactly_at_threshold(self, engine, base_tx):
        base_tx.amount = 100000.0
        result = engine.check_high_value(base_tx)

        assert result.score == 0.0

    def test_high_value_just_above_threshold(self, engine, base_tx):
        base_tx.amount = 100001.0
        result = engine.check_high_value(base_tx)

        assert result.score == 0.70


@pytest.mark.unit
class TestGeoAnomalyRule:
    def test_geo_anomaly_nigeria_triggers(self, engine, base_tx):
        base_tx.location.country = "Nigeria"
        result = engine.check_geo_anomaly(base_tx)

        assert result.score == 0.85

    def test_geo_anomaly_romania_triggers(self, engine, base_tx):
        base_tx.location.country = "Romania"
        result = engine.check_geo_anomaly(base_tx)

        assert result.score == 0.85

    def test_geo_anomaly_india_no_trigger(self, engine, base_tx):
        base_tx.location.country = "India"
        result = engine.check_geo_anomaly(base_tx)

        assert result.score == 0.0

    def test_geo_anomaly_usa_no_trigger(self, engine, base_tx):
        base_tx.location.country = "United States"
        result = engine.check_geo_anomaly(base_tx)

        assert result.score == 0.0


@pytest.mark.unit
class TestCardTestingRule:
    def test_card_testing_triggers_small_online(self, engine, base_tx):
        base_tx.amount = 10.0
        base_tx.channel = "ONLINE"
        base_tx.merchant_category = "ONLINE"
        result = engine.check_card_testing(base_tx)

        assert result.score == 0.85

    def test_card_testing_no_trigger_large_amount(self, engine, base_tx):
        base_tx.amount = 500.0
        base_tx.channel = "ONLINE"
        base_tx.merchant_category = "ONLINE"
        result = engine.check_card_testing(base_tx)

        assert result.score == 0.0

    def test_card_testing_no_trigger_non_online(self, engine, base_tx):
        base_tx.amount = 10.0
        base_tx.channel = "POS"
        result = engine.check_card_testing(base_tx)

        assert result.score == 0.0

    def test_card_testing_boundary_amount(self, engine, base_tx):
        base_tx.amount = 50.0
        base_tx.channel = "ONLINE"
        base_tx.merchant_category = "ONLINE"
        result = engine.check_card_testing(base_tx)

        assert result.score == 0.0


@pytest.mark.unit
class TestOddHoursRule:
    def test_odd_hours_triggers_at_2am(self, engine, base_tx):
        from datetime import datetime, timezone
        base_tx.timestamp = datetime(2026, 1, 1, 2, 0, 0, tzinfo=timezone.utc)
        result = engine.check_odd_hours(base_tx)

        assert result.score == 0.30

    def test_odd_hours_no_trigger_at_noon(self, engine, base_tx):
        from datetime import datetime, timezone
        base_tx.timestamp = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = engine.check_odd_hours(base_tx)

        assert result.score == 0.0

    def test_odd_hours_boundary_1am(self, engine, base_tx):
        from datetime import datetime, timezone
        base_tx.timestamp = datetime(2026, 1, 1, 1, 0, 0, tzinfo=timezone.utc)
        result = engine.check_odd_hours(base_tx)

        assert result.score == 0.30

    def test_odd_hours_boundary_4am(self, engine, base_tx):
        from datetime import datetime, timezone
        base_tx.timestamp = datetime(2026, 1, 1, 4, 0, 0, tzinfo=timezone.utc)
        result = engine.check_odd_hours(base_tx)

        assert result.score == 0.0


@pytest.mark.unit
class TestInternationalHighAmountRule:
    def test_international_high_amount_triggers(self, engine, base_tx):
        base_tx.is_international = True
        base_tx.amount = 60000.0
        result = engine.check_international_high_amount(base_tx)

        assert result.score == 0.75

    def test_international_low_amount_no_trigger(self, engine, base_tx):
        base_tx.is_international = True
        base_tx.amount = 10000.0
        result = engine.check_international_high_amount(base_tx)

        assert result.score == 0.0

    def test_domestic_high_amount_no_trigger(self, engine, base_tx):
        base_tx.is_international = False
        base_tx.amount = 60000.0
        result = engine.check_international_high_amount(base_tx)

        assert result.score == 0.0


@pytest.mark.unit
class TestRefundAbuseRule:
    def test_refund_abuse_triggers(self, engine, base_tx):
        from generator.models import TransactionType
        base_tx.transaction_type = TransactionType.REFUND
        base_tx.amount = 15000.0
        result = engine.check_refund_abuse(base_tx)

        assert result.score == 0.60

    def test_refund_small_amount_no_trigger(self, engine, base_tx):
        from generator.models import TransactionType
        base_tx.transaction_type = TransactionType.REFUND
        base_tx.amount = 5000.0
        result = engine.check_refund_abuse(base_tx)

        assert result.score == 0.0

    def test_non_refund_no_trigger(self, engine, base_tx):
        from generator.models import TransactionType
        base_tx.transaction_type = TransactionType.PURCHASE
        base_tx.amount = 15000.0
        result = engine.check_refund_abuse(base_tx)

        assert result.score == 0.0


@pytest.mark.unit
class TestVelocityRule:
    def test_high_velocity_triggers(self, engine, base_tx, redis_client):
        result = engine.analyze(base_tx, velocity=15)
        assert "velocity" in result["triggered_rules"]

    def test_normal_velocity_no_trigger(self, engine, base_tx):
        result = engine.analyze(base_tx, velocity=5)
        assert "velocity" not in result["triggered_rules"]


@pytest.mark.unit
class TestAnalyze:
    def test_analyze_returns_block_for_geo_anomaly(self, engine, base_tx):
        base_tx.location.country = "Nigeria"
        result = engine.analyze(base_tx)
        assert result["recommendation"] == "BLOCK"
        assert result["fraud_score"] == 0.85
        assert result["is_suspicious"] is True

    def test_analyze_returns_approve_for_clean_tx(self, engine, base_tx):
        result = engine.analyze(base_tx)
        assert result["recommendation"] == "APPROVE"
        assert result["is_suspicious"] is False

    def test_analyze_returns_review_for_mid_score(self, engine, base_tx):
        base_tx.amount = 150000.0  # triggers high_value = 0.70 -> REVIEW
        result = engine.analyze(base_tx)
        assert result["recommendation"] == "REVIEW"

    def test_analyze_score_is_max_of_all_rules(self, engine, base_tx):
        base_tx.amount = 150000.0      # 0.70
        base_tx.location.country = "Nigeria"  # 0.85 — should win
        result = engine.analyze(base_tx)
        assert result["fraud_score"] == 0.85
