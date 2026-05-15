"""Integration tests for the Fraud Detection Service (:8001)."""
import pytest
import json


@pytest.mark.integration
class TestFraudServiceHealth:
    def test_health_returns_ok(self, fraud_client):
        resp = fraud_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    def test_health_shows_redis_connected(self, fraud_client):
        resp = fraud_client.get("/health")
        assert resp.json()["redis"] is True


@pytest.mark.integration
class TestAnalyzeEndpoint:
    def test_analyze_clean_transaction(self, fraud_client, sample_transaction):
        resp = fraud_client.post(
            "/analyze",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "fraud_score" in data
        assert "recommendation" in data
        assert "is_suspicious" in data

    def test_analyze_geo_anomaly_blocked(self, fraud_client, sample_transaction):
        sample_transaction.location.country = "Nigeria"
        resp = fraud_client.post(
            "/analyze",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["recommendation"] == "BLOCK"
        assert data["fraud_score"] == 0.85

    def test_analyze_high_value_reviewed(self, fraud_client, sample_transaction):
        sample_transaction.amount = 150000.0
        sample_transaction.location.country = "India"
        resp = fraud_client.post(
            "/analyze",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        assert resp.json()["recommendation"] == "REVIEW"

    def test_analyze_card_testing_blocked(self, fraud_client, sample_transaction):
        sample_transaction.amount = 10.0
        sample_transaction.channel = "ONLINE"
        sample_transaction.merchant_category = "ONLINE"
        resp = fraud_client.post(
            "/analyze",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        assert resp.json()["recommendation"] == "BLOCK"

    def test_analyze_invalid_payload_returns_422(self, fraud_client):
        resp = fraud_client.post(
            "/analyze",
            json={"invalid": "data"},
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422


@pytest.mark.integration
class TestAnalyzeBatchEndpoint:
    def test_batch_analyze_returns_results(self, fraud_client, transaction_factory):
        batch = [json.loads(tx.model_dump_json())
                 for tx in transaction_factory.generate_batch(10)]
        resp = fraud_client.post("/analyze/batch", json=batch)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 10

    def test_batch_each_result_has_required_fields(self, fraud_client, transaction_factory):
        batch = [json.loads(tx.model_dump_json())
                 for tx in transaction_factory.generate_batch(5)]
        resp = fraud_client.post("/analyze/batch", json=batch)
        for result in resp.json()["results"]:
            assert "fraud_score" in result
            assert "recommendation" in result

    def test_batch_exceeding_limit_returns_422(self, fraud_client, transaction_factory):
        batch = [json.loads(tx.model_dump_json())
                 for tx in transaction_factory.generate_batch(501)]
        resp = fraud_client.post("/analyze/batch", json=batch)
        assert resp.status_code == 422


@pytest.mark.integration
class TestFraudMetrics:
    def test_metrics_endpoint_returns_200(self, fraud_client):
        resp = fraud_client.get("/metrics")
        assert resp.status_code == 200

    def test_metrics_contains_fraud_counter(self, fraud_client):
        resp = fraud_client.get("/metrics")
        assert "fraud_checks_total" in resp.text