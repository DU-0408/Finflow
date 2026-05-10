from __future__ import annotations

import time
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter(
    "api_requests_total",
    "Total API requests",
    ["method", "endpoint", "status_code"]
)

REQUEST_DURATION = Histogram(
    "api_request_duration_seconds",
    "API request duration",
    ["method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)


class LoggingMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        start = time.time()

        response = await call_next(request)

        duration = time.time() - start
        endpoint = request.url.path

        logger.info(
            f"{request.method} {endpoint} "
            f"→ {response.status_code} "
            f"({duration*1000:.1f}ms)"
        )

        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status_code=response.status_code
        ).inc()

        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=endpoint
        ).observe(duration)

        return response