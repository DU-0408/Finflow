"""Unit tests for PostgreSQL database layer using real finflow_test DB."""
import pytest
from generator.factory import TransactionFactory


@pytest.mark.unit
class TestDatabaseConnection:
    def test_connect_succeeds(self, db):
        assert db.conn is not None
        assert db.conn.closed == 0

    def test_tables_exist(self, db):
        cur = db.conn.cursor()
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
        """)
        tables = {row[0] for row in cur.fetchall()}
        cur.close()
        assert "transactions" in tables
        assert "fraud_alerts" in tables


@pytest.mark.unit
class TestInsertTransaction:
    def test_insert_single_transaction(self, db, sample_transaction):
        db.insert_transaction(sample_transaction)
        result = db.get_transaction_by_id(str(sample_transaction.transaction_id))
        assert result is not None

    def test_inserted_transaction_fields(self, db, sample_transaction):
        db.insert_transaction(sample_transaction)
        result = db.get_transaction_by_id(str(sample_transaction.transaction_id))
        assert str(result["transaction_id"]) == str(sample_transaction.transaction_id)
        assert float(result["amount"]) == pytest.approx(float(sample_transaction.amount), rel=1e-2)

    def test_insert_multiple_transactions(self, db, transaction_factory):
        batch = transaction_factory.generate_batch(10)
        for tx in batch:
            db.insert_transaction(tx)
        results = db.get_transactions(limit=20)
        assert len(results) == 10

    def test_get_transactions_respects_limit(self, db, transaction_factory):
        batch = transaction_factory.generate_batch(20)
        for tx in batch:
            db.insert_transaction(tx)
        results = db.get_transactions(limit=5)
        assert len(results) == 5


@pytest.mark.unit
class TestFraudAlerts:
    def test_insert_fraud_alert(self, db, fraud_transaction):
        db.insert_transaction(fraud_transaction)
        fraud_transaction.fraud_score=0.85
        db.insert_fraud_alert(fraud_transaction, pattern="geo_anomaly")
        alerts = db.get_fraud_alerts()
        assert len(alerts) == 1

    def test_fraud_alert_fields(self, db, fraud_transaction):
        db.insert_transaction(fraud_transaction)
        fraud_transaction.fraud_score=0.85
        db.insert_fraud_alert(fraud_transaction, pattern="geo_anomaly")
        alerts = db.get_fraud_alerts()
        alert = alerts[0]
        assert float(alert["fraud_score"]) == pytest.approx(0.85, rel=1e-2)
        assert alert["pattern"] == "geo_anomaly"

    def test_multiple_fraud_alerts(self, db, transaction_factory):
        factory = TransactionFactory(fraud_rate=1.0)
        for _ in range(3):
            tx = factory.generate(force_fraud=True)
            db.insert_transaction(tx)
            tx.fraud_score=0.85
            db.insert_fraud_alert(tx, pattern="geo_anomaly")
        alerts = db.get_fraud_alerts()
        assert len(alerts) == 3


@pytest.mark.unit
class TestStats:
    def test_stats_empty_db(self, db):
        stats = db.get_stats()
        assert stats["total"] == 0
        assert stats["fraud_count"] == 0

    def test_stats_after_inserts(self, db, transaction_factory):
        factory = TransactionFactory(fraud_rate=0.0)
        for tx in factory.generate_batch(5):
            db.insert_transaction(tx)
        stats = db.get_stats()
        assert stats["total"] == 5

    def test_stats_fraud_count(self, db):
        factory = TransactionFactory(fraud_rate=1.0)
        for _ in range(3):
            tx = factory.generate(force_fraud=True)
            tx.is_suspicious = True
            db.insert_transaction(tx)
            tx.fraud_score=0.85
            db.insert_fraud_alert(tx, pattern="geo_anomaly")
        stats = db.get_stats()
        assert stats["fraud_count"] == 3