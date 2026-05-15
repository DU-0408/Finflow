"""Unit tests for Redis cache layer using real Redis DB 1."""
import pytest
from generator.cache import CacheManager
from generator.factory import TransactionFactory


@pytest.fixture
def cache(redis_client):
    """Cache instance backed by real Redis DB 1."""
    c = CacheManager()
    yield c


@pytest.mark.unit
class TestDeduplication:
    def test_new_transaction_not_duplicate(self, cache, sample_transaction):
        assert cache.is_duplicate(sample_transaction.transaction_id) is False

    def test_seen_transaction_is_duplicate(self, cache, sample_transaction):
        cache.mark_seen(sample_transaction.transaction_id)
        assert cache.is_duplicate(sample_transaction.transaction_id) is True

    def test_different_transactions_not_duplicate(self, cache, transaction_factory):
        tx1 = transaction_factory.generate()
        tx2 = transaction_factory.generate()
        cache.mark_seen(tx1.transaction_id)
        assert cache.is_duplicate(tx2.transaction_id) is False

    def test_mark_seen_sets_ttl(self, cache, sample_transaction):
        cache.mark_seen(sample_transaction.transaction_id)
        import redis as redis_lib, os
        r = redis_lib.Redis(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            db=1,
        )
        ttl = r.ttl(f"tx:seen:{sample_transaction.transaction_id}")
        assert ttl > 0
        assert ttl <= 86400  # 24 hours


@pytest.mark.unit
class TestVelocityTracking:
    def test_initial_velocity_is_zero(self, cache, sample_transaction):
        vel = cache.get_account_velocity(sample_transaction.account_id)
        assert vel == 0

    def test_increment_velocity(self, cache, sample_transaction):
        cache.increment_velocity(sample_transaction.account_id)
        vel = cache.get_account_velocity(sample_transaction.account_id)
        assert vel == 1

    def test_multiple_increments(self, cache, sample_transaction):
        for _ in range(5):
            cache.increment_velocity(sample_transaction.account_id)
        vel = cache.get_account_velocity(sample_transaction.account_id)
        assert vel == 5

    def test_is_high_velocity_false_below_limit(self, cache, sample_transaction):
        for _ in range(9):
            cache.increment_velocity(sample_transaction.account_id)
        assert cache.is_high_velocity(sample_transaction.account_id) is False

    def test_is_high_velocity_true_above_limit(self, cache, sample_transaction):
        for _ in range(11):
            cache.increment_velocity(sample_transaction.account_id)
        assert cache.is_high_velocity(sample_transaction.account_id) is True

    def test_velocity_isolated_per_account(self, cache, transaction_factory):
        tx1 = transaction_factory.generate()
        tx2 = transaction_factory.generate()
        for _ in range(11):
            cache.increment_velocity(tx1.account_id)
        assert cache.is_high_velocity(tx1.account_id) is True
        assert cache.is_high_velocity(tx2.account_id) is False