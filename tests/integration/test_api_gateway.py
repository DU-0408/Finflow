"""Integration tests for the API Gateway (:8000)."""
import pytest
import json
from unittest.mock import patch

@pytest.fixture(autouse=True)
def mock_http():
    with patch("api_gateway.pipeline.httpx.post") as mock_post:
        def side_effect(url, **kwargs):
            class MockResp:
                def __init__(self, data): self._data = data
                def json(self): return self._data
                def raise_for_status(self): pass
            if "analyze" in url:
                data = kwargs.get("content") or kwargs.get("json")
                if isinstance(data, str): data = json.loads(data)
                elif isinstance(data, bytes): data = json.loads(data.decode())
                if isinstance(data, list):
                    res = []
                    for tx in data:
                        is_susp = tx.get("is_suspicious", False)
                        res.append({"is_suspicious": is_susp, "fraud_score": 0.85 if is_susp else 0.1, "triggered_rules": ["mock"] if is_susp else [], "recommendation": "BLOCK" if is_susp else "APPROVE"})
                    return MockResp(res)
                else:
                    is_susp = data.get("is_suspicious", False)
                    return MockResp({"is_suspicious": is_susp, "fraud_score": 0.85 if is_susp else 0.1, "triggered_rules": ["mock"] if is_susp else [], "recommendation": "BLOCK" if is_susp else "APPROVE"})
            return MockResp({"status": "sent"})
        mock_post.side_effect = side_effect
        yield mock_post



@pytest.mark.integration
class TestGatewayHealth:
    def test_health_returns_ok(self, api_client):
        resp = api_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["postgres"] is True
        assert data["redis"] is True


@pytest.mark.integration
class TestSingleTransaction:
    def test_post_transaction_returns_200(self, api_client, sample_transaction):
        resp = api_client.post(
            "/transactions",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200

    def test_post_transaction_response_has_pipeline_fields(self, api_client, sample_transaction):
        resp = api_client.post(
            "/transactions",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        data = resp.json()
        assert "transaction_id" in data
        assert "fraud_analysis" in data
        assert "status" in data

    def test_duplicate_transaction_rejected(self, api_client, sample_transaction):
        api_client.post(
            "/transactions",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        resp = api_client.post(
            "/transactions",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "duplicate"

    def test_fraud_transaction_flagged(self, api_client, fraud_transaction):
        resp = api_client.post(
            "/transactions",
            content=fraud_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["fraud_analysis"]["is_suspicious"] is True

    def test_invalid_payload_returns_422(self, api_client):
        resp = api_client.post(
            "/transactions",
            json={"invalid": "data"},
        )
        assert resp.status_code == 422


@pytest.mark.integration
class TestBatchTransactions:
    def test_batch_post_returns_200(self, api_client, transaction_factory):
        batch = [json.loads(tx.model_dump_json())
                 for tx in transaction_factory.generate_batch(10)]
        resp = api_client.post("/transactions/batch", json=batch)
        assert resp.status_code == 200

    def test_batch_response_count_matches(self, api_client, transaction_factory):
        batch = [json.loads(tx.model_dump_json())
                 for tx in transaction_factory.generate_batch(10)]
        resp = api_client.post("/transactions/batch", json=batch)
        data = resp.json()
        assert data["processed"] == 10

    def test_batch_exceeding_limit_returns_422(self, api_client, transaction_factory):
        batch = [json.loads(tx.model_dump_json())
                 for tx in transaction_factory.generate_batch(1001)]
        resp = api_client.post("/transactions/batch", json=batch)
        assert resp.status_code == 422


@pytest.mark.integration
class TestGetTransactions:
    def test_get_transactions_returns_list(self, api_client, sample_transaction):
        api_client.post(
            "/transactions",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        resp = api_client.get("/transactions")
        assert resp.status_code == 200
        assert isinstance(resp.json()["transactions"], list)

    def test_get_transactions_respects_limit(self, api_client, transaction_factory):
        batch = [json.loads(tx.model_dump_json())
                 for tx in transaction_factory.generate_batch(10)]
        api_client.post("/transactions/batch", json=batch)
        resp = api_client.get("/transactions?limit=5")
        assert len(resp.json()["transactions"]) <= 5

    def test_get_transaction_by_id(self, api_client, sample_transaction):
        api_client.post(
            "/transactions",
            content=sample_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        resp = api_client.get(f"/transactions/{sample_transaction.transaction_id}")
        assert resp.status_code == 200
        assert str(resp.json()["transaction_id"]) == str(sample_transaction.transaction_id)

    def test_get_nonexistent_transaction_returns_404(self, api_client):
        resp = api_client.get("/transactions/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


@pytest.mark.integration
class TestFraudAlerts:
    def test_get_fraud_alerts_returns_list(self, api_client):
        resp = api_client.get("/fraud-alerts")
        assert resp.status_code == 200
        assert isinstance(resp.json()["alerts"], list)

    def test_fraud_alert_created_after_flagged_transaction(self, api_client, fraud_transaction):
        api_client.post(
            "/transactions",
            content=fraud_transaction.model_dump_json(),
            headers={"Content-Type": "application/json"},
        )
        resp = api_client.get("/fraud-alerts")
        assert len(resp.json()) >= 1


@pytest.mark.integration
class TestStats:
    def test_stats_returns_200(self, api_client):
        resp = api_client.get("/stats")
        assert resp.status_code == 200

    def test_stats_has_required_fields(self, api_client):
        resp = api_client.get("/stats")
        data = resp.json()
        assert "total" in data
        assert "fraud_count" in data
        assert "avg_amount" in data
        assert "total_volume" in data


@pytest.mark.integration
class TestSimulate:
    def test_simulate_endpoint_returns_200(self, api_client):
        resp = api_client.post("/simulate?count=5&fraud_rate=0.2")
        assert resp.status_code == 200

    def test_simulate_processes_correct_count(self, api_client):
        resp = api_client.post("/simulate?count=5&fraud_rate=0.0")
        data = resp.json()
        assert data["processed"] == 5


@pytest.mark.integration
class TestGatewayMetrics:
    def test_metrics_endpoint_returns_200(self, api_client):
        resp = api_client.get("/metrics")
        assert resp.status_code == 200

    def test_metrics_contains_api_counter(self, api_client):
        resp = api_client.get("/metrics")
        assert "api_requests_total" in resp.text