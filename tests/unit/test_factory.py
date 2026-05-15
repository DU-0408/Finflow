"""Unit tests for TransactionFactory."""
import pytest
from generator.factory import TransactionFactory, AccountPool
from generator.models import Transaction, TransactionType


@pytest.mark.unit
class TestAccountPool:
    def test_generates_500_accounts(self):
        pool = AccountPool()
        assert len(pool.accounts) == 500

    def test_accounts_have_required_fields(self):
        pool = AccountPool()
        account = pool.accounts[0]
        assert "account_id" in account
        assert "home_city" in account
        assert "risk_profile" in account

    def test_risk_profiles_are_valid(self):
        pool = AccountPool()
        valid = {"LOW", "MEDIUM", "HIGH"}
        for acc in pool.accounts:
            assert acc["risk_profile"] in valid

    def test_random_account_returns_dict(self):
        pool = AccountPool()
        acc = pool.pick()
        assert isinstance(acc, dict)


@pytest.mark.unit
class TestTransactionFactory:
    def test_generate_returns_transaction(self, transaction_factory):
        tx = transaction_factory.generate()
        assert isinstance(tx, Transaction)

    def test_generate_batch_returns_correct_count(self, transaction_factory):
        batch = transaction_factory.generate_batch(10)
        assert len(batch) == 10

    def test_all_batch_items_are_transactions(self, transaction_factory):
        batch = transaction_factory.generate_batch(5)
        assert all(isinstance(tx, Transaction) for tx in batch)

    def test_transaction_ids_are_unique(self, transaction_factory):
        batch = transaction_factory.generate_batch(100)
        ids = [tx.transaction_id for tx in batch]
        assert len(set(ids)) == 100

    def test_force_fraud_sets_suspicious(self):
        factory = TransactionFactory(fraud_rate=1.0)
        tx = factory.generate(force_fraud=True)
        assert tx.is_suspicious is True

    def test_zero_fraud_rate_no_suspicious(self, transaction_factory):
        batch = transaction_factory.generate_batch(50)
        suspicious = [tx for tx in batch if tx.is_suspicious]
        assert len(suspicious) == 0

    def test_amounts_are_positive(self, transaction_factory):
        batch = transaction_factory.generate_batch(50)
        assert all(tx.amount > 0 for tx in batch)

    def test_indian_currency_default(self, transaction_factory):
        batch = transaction_factory.generate_batch(20)
        domestic = [tx for tx in batch if not tx.is_international]
        assert all(tx.currency == "INR" for tx in domestic)

    def test_transaction_types_are_valid(self, transaction_factory):
        batch = transaction_factory.generate_batch(50)
        valid_types = set(TransactionType)
        assert all(tx.transaction_type in valid_types for tx in batch)

    def test_fraud_patterns_high_value(self):
        factory = TransactionFactory(fraud_rate=1.0)
        txs = [factory.generate(force_fraud=True) for _ in range(20)]
        high_value = [tx for tx in txs if tx.amount >= 200000]
        assert len(high_value) > 0

    def test_fraud_patterns_geo_anomaly(self):
        factory = TransactionFactory(fraud_rate=1.0)
        txs = [factory.generate(force_fraud=True) for _ in range(30)]
        geo_anomaly = [tx for tx in txs if tx.location.country == "Nigeria"]
        assert len(geo_anomaly) > 0

    def test_fraud_patterns_card_testing(self):
        factory = TransactionFactory(fraud_rate=1.0)
        txs = [factory.generate(force_fraud=True) for _ in range(30)]
        card_test = [tx for tx in txs if tx.amount < 50 and tx.channel == "ONLINE"]
        assert len(card_test) > 0