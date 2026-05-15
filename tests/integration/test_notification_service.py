"""Integration tests for the Notification Service (:8002)."""
import pytest


@pytest.mark.integration
class TestNotificationHealth:
    def test_health_returns_ok(self, notification_client):
        resp = notification_client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_health_shows_mock_notifier(self, notification_client):
        resp = notification_client.get("/health")
        assert resp.json()["notifier"] == "MockNotifier"


@pytest.mark.integration
class TestFraudAlert:
    def test_fraud_alert_returns_200(self, notification_client, fraud_transaction):
        payload = {
            "transaction_id": str(fraud_transaction.transaction_id),
            "account_id": fraud_transaction.account_id,
            "amount": float(fraud_transaction.amount),
            "fraud_score": 0.85,
            "triggered_rules": ["geo_anomaly"],
            "recommendation": "BLOCK",
        }
        resp = notification_client.post("/alert/fraud", json=payload)
        assert resp.status_code == 200

    def test_fraud_alert_response_structure(self, notification_client, fraud_transaction):
        payload = {
            "transaction_id": str(fraud_transaction.transaction_id),
            "account_id": fraud_transaction.account_id,
            "amount": float(fraud_transaction.amount),
            "fraud_score": 0.85,
            "triggered_rules": ["geo_anomaly"],
            "recommendation": "BLOCK",
        }
        resp = notification_client.post("/alert/fraud", json=payload)
        data = resp.json()
        assert "status" in data
        assert data["status"] == "sent"

    def test_fraud_alert_missing_fields_returns_422(self, notification_client):
        resp = notification_client.post("/alert/fraud", json={"invalid": "data"})
        assert resp.status_code == 422


@pytest.mark.integration
class TestHighValueAlert:
    def test_high_value_alert_returns_200(self, notification_client, sample_transaction):
        payload = {
            "transaction_id": str(sample_transaction.transaction_id),
            "account_id": sample_transaction.account_id,
            "amount": 150000.0,
        }
        resp = notification_client.post("/alert/high-value", json=payload)
        assert resp.status_code == 200

    def test_high_value_alert_response_structure(self, notification_client, sample_transaction):
        payload = {
            "transaction_id": str(sample_transaction.transaction_id),
            "account_id": sample_transaction.account_id,
            "amount": 150000.0,
        }
        resp = notification_client.post("/alert/high-value", json=payload)
        assert resp.json()["status"] == "sent"


@pytest.mark.integration
class TestBatchAlerts:
    def test_batch_alerts_returns_200(self, notification_client, transaction_factory):
        alerts = [
            {
                "transaction_id": str(tx.transaction_id),
                "account_id": tx.account_id,
                "amount": float(tx.amount),
                "fraud_score": 0.85,
                "triggered_rules": ["geo_anomaly"],
            "recommendation": "BLOCK",
                
            }
            for tx in transaction_factory.generate_batch(5)
        ]
        resp = notification_client.post("/alert/batch", json=alerts)
        assert resp.status_code == 200

    def test_batch_exceeding_limit_returns_422(self, notification_client, transaction_factory):
        alerts = [
            {
                "transaction_id": str(tx.transaction_id),
                "account_id": tx.account_id,
                "amount": float(tx.amount),
                "fraud_score": 0.85,
                "triggered_rules": ["geo_anomaly"],
            "recommendation": "BLOCK",
                
            }
            for tx in transaction_factory.generate_batch(101)
        ]
        resp = notification_client.post("/alert/batch", json=alerts)
        assert resp.status_code == 422


@pytest.mark.integration
class TestNotificationMetrics:
    def test_metrics_endpoint_returns_200(self, notification_client):
        resp = notification_client.get("/metrics")
        assert resp.status_code == 200