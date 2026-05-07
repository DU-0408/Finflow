"""
Usage:
    python -m generator.main --mode local --tps 10 --duration 30
    python -m generator.main --mode stream --tps 100
    python -m generator.main --mode batch --batch-size 500
"""

from __future__ import annotations

import argparse
import time
import signal
import sys
import logging
from datetime import datetime

from dotenv import load_dotenv
from prometheus_client import Counter, start_http_server

from .factory   import TransactionFactory
from .producers import KinesisProducer, APIProducer, LocalProducer

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Prometheus metrics ────────────────────────────────────────────────────────
TRANSACTIONS_TOTAL = Counter("transactions_generated_total",  "Total transactions generated")
FRAUD_TOTAL        = Counter("fraud_transactions_total",       "Total fraudulent transactions")
ERRORS_TOTAL       = Counter("generator_errors_total",         "Total send errors")


# ── Graceful shutdown ─────────────────────────────────────────────────────────
running = True

def _handle_signal(sig, frame):
    global running
    logger.info("Shutdown signal received — stopping generator...")
    running = False

signal.signal(signal.SIGINT,  _handle_signal)
signal.signal(signal.SIGTERM, _handle_signal)


# ── Stats printer ─────────────────────────────────────────────────────────────

def print_stats(total: int, fraud: int, errors: int, start: float):
    elapsed   = time.time() - start
    tps_actual = total / elapsed if elapsed > 0 else 0
    fraud_pct  = (fraud / total * 100) if total > 0 else 0
    print(
        f"\n{'─'*55}\n"
        f"  Transactions : {total:,}\n"
        f"  Fraud        : {fraud:,}  ({fraud_pct:.1f}%)\n"
        f"  Errors       : {errors:,}\n"
        f"  Actual TPS   : {tps_actual:.1f}\n"
        f"  Elapsed      : {elapsed:.0f}s\n"
        f"{'─'*55}"
    )


# ── Modes ─────────────────────────────────────────────────────────────────────

def run_stream(factory, producer, tps: int, duration: int | None):
    """Send one transaction at a time to Kinesis."""
    total = fraud = errors = 0
    start = time.time()
    interval = 1.0 / tps

    logger.info(f"Stream mode — target {tps} TPS")

    while running:
        if duration and (time.time() - start) >= duration:
            break

        loop_start = time.time()
        tx = factory.generate()

        ok = producer.send(tx)
        total += 1
        TRANSACTIONS_TOTAL.inc()

        if tx.is_suspicious:
            fraud += 1
            FRAUD_TOTAL.inc()

        if not ok:
            errors += 1
            ERRORS_TOTAL.inc()

        if total % (tps * 10) == 0:          # print stats every 10 seconds
            print_stats(total, fraud, errors, start)

        elapsed = time.time() - loop_start
        sleep   = interval - elapsed
        if sleep > 0:
            time.sleep(sleep)

    print_stats(total, fraud, errors, start)
    logger.info("Stream mode finished.")


def run_batch(factory, producer, batch_size: int, duration: int | None):
    """Generate and send transactions in batches."""
    total = fraud = errors = 0
    start = time.time()

    logger.info(f"Batch mode — batch size {batch_size}")

    while running:
        if duration and (time.time() - start) >= duration:
            break

        batch = factory.generate_batch(batch_size)
        ok    = producer.send_batch(batch)

        total  += len(batch)
        fraud  += sum(1 for tx in batch if tx.is_suspicious)
        errors += 0 if ok else len(batch)

        TRANSACTIONS_TOTAL.inc(len(batch))
        FRAUD_TOTAL.inc(sum(1 for tx in batch if tx.is_suspicious))

        print_stats(total, fraud, errors, start)
        time.sleep(2)

    logger.info("Batch mode finished.")


def run_local(factory, producer, tps: int, duration: int | None):
    """Print transactions to console — no AWS needed."""
    total = fraud = errors = 0
    start = time.time()
    interval = 1.0 / tps

    logger.info(f"Local mode — {tps} TPS — printing to console")
    print(f"{'#':<6} {'STATUS':<10} {'TYPE':<22} {'AMOUNT':>14} {'MERCHANT':<22} CITY\n{'─'*90}")

    while running:
        if duration and (time.time() - start) >= duration:
            break

        tx = factory.generate()
        producer.send(tx)

        total += 1
        if tx.is_suspicious:
            fraud += 1

        time.sleep(interval)

    print_stats(total, fraud, errors, start)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="FinFlow Transaction Generator")
    parser.add_argument("--mode",       choices=["stream", "batch", "local"], default="local")
    parser.add_argument("--tps",        type=int, default=10,  help="Transactions per second")
    parser.add_argument("--duration",   type=int, default=None, help="Run duration in seconds")
    parser.add_argument("--batch-size", type=int, default=500,  help="Batch size (batch mode only)")
    parser.add_argument("--fraud-rate", type=float, default=None, help="Override fraud rate (0.0–1.0)")
    parser.add_argument("--metrics-port", type=int, default=8003, help="Prometheus metrics port")
    args = parser.parse_args()

    # Start Prometheus metrics server
    start_http_server(args.metrics_port)
    logger.info(f"Prometheus metrics on :{args.metrics_port}")

    fraud_rate = args.fraud_rate if args.fraud_rate is not None else 0.02
    factory    = TransactionFactory(fraud_rate=fraud_rate)

    if args.mode == "stream":
        producer = KinesisProducer()
        run_stream(factory, producer, args.tps, args.duration)

    elif args.mode == "batch":
        producer = APIProducer()
        run_batch(factory, producer, args.batch_size, args.duration)

    else:
        producer = LocalProducer()
        run_local(factory, producer, args.tps, args.duration)


if __name__ == "__main__":
    main()
