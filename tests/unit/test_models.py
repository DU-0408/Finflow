"""Unit tests for Pydantic data models."""
import pytest
from generator.models import (
    Transaction, TransactionType, TransactionStatus,
    MerchantCategory, GeoLocation,
)


@pytest.mark.unit
class TestGeoLocation:
    def test_valid_geolocation(self):
        geo = GeoLocation(country="India", city="Mumbai", latitude=19.07, longitude=72.87)
        assert geo.country == "India"
        assert geo.city == "Mumbai"

    def test_lat_lon_are_floats(self):
        geo = GeoLocation(country="India", city="Delhi", latitude=28.61, longitude=77.20)
        assert isinstance(geo.latitude, float)
        assert isinstance(geo.longitude, float)


@pytest.mark.unit
class TestTransactionEnums:
    def test_transaction_types(self):
        expected = {"PURCHASE", "ATM_WITHDRAWAL", "ONLINE_TRANSFER",
                    "BILL_PAYMENT", "REFUND", "INTERNATIONAL"}
        assert {t.value for t in TransactionType} == expected

    def test_transaction_statuses(self):
        expected = {"PENDING", "APPROVED", "DECLINED", "FLAGGED"}
        assert {s.value for s in TransactionStatus} == expected

    def test_merchant_categories_count(self):
        assert len(MerchantCategory) == 12


@pytest.mark.unit
class TestTransactionModel:
    def test_transaction_has_required_fields(self, sample_transaction):
        assert sample_transaction.transaction_id is not None
        assert sample_transaction.account_id is not None
        assert sample_transaction.amount > 0

    def test_fraud_score_range(self, sample_transaction):
        if sample_transaction.fraud_score is not None:
            assert 0.0 <= sample_transaction.fraud_score <= 1.0

    def test_default_status_is_pending(self, sample_transaction):
        assert sample_transaction.status == TransactionStatus.PENDING

    def test_transaction_serializes_to_json(self, sample_transaction):
        data = sample_transaction.model_dump_json()
        assert "transaction_id" in data
        assert "amount" in data

    def test_transaction_roundtrip(self, sample_transaction):
        data = sample_transaction.model_dump()
        restored = Transaction(**data)
        assert restored.transaction_id == sample_transaction.transaction_id

    def test_is_high_value_flag(self):
        from generator.factory import TransactionFactory
        tx = TransactionFactory().generate(force_fraud=True)
        # force_fraud can produce high_value pattern
        assert isinstance(tx.is_high_value, bool)

    def test_is_suspicious_default_false(self, sample_transaction):
        assert sample_transaction.is_suspicious is False