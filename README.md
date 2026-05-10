# FinFlow — Banking Transaction Data Pipeline

A production-grade ETL pipeline simulating real-world banking transaction
data flows across stream ingestion, fraud detection, multi-layer storage,
and real-time monitoring.

Built as a portfolio project targeting enterprise banking technology roles.

---

## Architecture
Transaction Generator
│
▼
API Gateway (:8000)
│
├──► Fraud Detection Service (:8001)
│           │
│           └──► Notification Service (:8002)
│
├──► PostgreSQL (transactions + fraud_alerts)
│
└──► Redis (deduplication + velocity tracking)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| API Framework | FastAPI |
| SQL Database | PostgreSQL 15 |
| NoSQL / Cache | Redis 7 |
| Cloud | AWS (Kinesis, Lambda, S3, SNS, CloudWatch) |
| Monitoring | Prometheus, Grafana |
| Deployment | Docker, k3s, GitHub Actions |
| Infrastructure | Terraform |
| Data Generation | Faker (Indian locale) |

---

## Services

| Service | Port | Purpose |
|---|---|---|
| api_gateway | 8000 | Single entry point — receives, validates, orchestrates |
| fraud_service | 8001 | Rule-based fraud detection engine |
| notification_service | 8002 | Alert dispatcher (AWS SNS / Mock) |
| generator metrics | 8003 | Prometheus metrics for the generator |
| PostgreSQL | 5432 | Transaction ledger + fraud alerts |
| Redis | 6379 | Deduplication cache + velocity tracking |

---

## Project Structure
finflow/
├── generator/
│   ├── models.py          # Pydantic data models (Transaction, enums)
│   ├── factory.py         # Synthetic transaction generator (Faker)
│   ├── producers.py       # Kinesis / API / Local producers
│   ├── main.py            # CLI entry point (--mode, --tps, --duration)
│   ├── db.py              # PostgreSQL layer (psycopg2)
│   └── cache.py           # Redis layer (dedup + velocity)
├── fraud_service/
│   ├── rules.py           # 7-rule fraud engine (score 0.0–1.0)
│   ├── metrics.py         # Prometheus counters
│   └── main.py            # FastAPI app (:8001)
├── notification_service/
│   ├── notifier.py        # SNSNotifier + MockNotifier
│   └── main.py            # FastAPI app (:8002)
├── api_gateway/
│   ├── middleware.py      # Request logging + Prometheus metrics
│   ├── pipeline.py        # Full transaction orchestration logic
│   └── main.py            # FastAPI app (:8000)
├── infrastructure/
│   ├── terraform/         # AWS provisioning (Kinesis, Lambda, S3, SNS)
│   └── k8s/               # k3s deployment manifests
├── monitoring/
│   ├── prometheus/        # Scrape configs
│   └── grafana/           # Dashboard JSON
├── .github/
│   └── workflows/         # CI/CD pipeline (lint → test → build → deploy)
├── docker-compose.yml     # Local PostgreSQL + Redis
├── requirements.txt
├── .env.example
└── .gitignore

---

## Quick Start

### Prerequisites
- Python 3.11+
- Docker Desktop
- Git

### 1. Clone and set up

```bash
git clone https://github.com/YOUR_USERNAME/finflow.git
cd finflow
python -m venv venv
source venv/bin/activate        # Mac/Linux
pip install -r requirements.txt
cp .env.example .env
```

### 2. Start databases

```bash
docker-compose up -d
```

### 3. Start all services

Open 3 separate terminals:

```bash
# Terminal 1 — Fraud Detection
uvicorn fraud_service.main:app --port 8001 --reload

# Terminal 2 — Notifications
uvicorn notification_service.main:app --port 8002 --reload

# Terminal 3 — API Gateway
uvicorn api_gateway.main:app --port 8000 --reload
```

### 4. Verify everything is running

```bash
curl http://localhost:8000/health
```

Expected:
```json
{
  "status": "ok",
  "service": "api_gateway",
  "postgres": true,
  "redis": true
}
```

---

## Usage

### Simulate transactions (best for demos)

```bash
# Generate and process 20 transactions with 20% fraud rate
curl -X POST "http://localhost:8000/simulate?count=20&fraud_rate=0.2"
```

### Submit a single transaction

```bash
python -c "
import httpx
from generator.factory import TransactionFactory

tx = TransactionFactory().generate(force_fraud=True)
resp = httpx.post(
    'http://localhost:8000/transactions',
    content=tx.model_dump_json(),
    headers={'Content-Type': 'application/json'}
)
import json
print(json.dumps(resp.json(), indent=2))
"
```

### Submit a batch

```bash
python -c "
import httpx, json
from generator.factory import TransactionFactory

batch = [json.loads(tx.model_dump_json())
         for tx in TransactionFactory(fraud_rate=0.3).generate_batch(50)]
resp = httpx.post('http://localhost:8000/transactions/batch', json=batch, timeout=30)
print(json.dumps(resp.json(), indent=2))
"
```

### Run the generator continuously

```bash
# Local mode — no AWS needed
python -m generator.main --mode local --tps 10 --duration 60

# Higher fraud rate to see more alerts
python -m generator.main --mode local --tps 5 --duration 30 --fraud-rate 0.3
```

### Query the pipeline

```bash
# All transactions (paginated)
curl "http://localhost:8000/transactions?limit=10"

# Single transaction
curl "http://localhost:8000/transactions/{transaction_id}"

# Fraud alerts
curl "http://localhost:8000/fraud-alerts"

# Pipeline stats
curl "http://localhost:8000/stats"
```

---

## API Reference

Full interactive docs available at:

| Service | Swagger UI |
|---|---|
| API Gateway | http://localhost:8000/docs |
| Fraud Service | http://localhost:8001/docs |
| Notification Service | http://localhost:8002/docs |

---

## Fraud Detection Rules

The fraud engine runs 7 independent rules, each scoring 0.0–1.0.
Final score is the maximum across all rules.

| Rule | Trigger Condition | Score |
|---|---|---|
| high_value | Amount > ₹1,00,000 | 0.70 |
| geo_anomaly | Transaction from high-risk country | 0.85 |
| card_testing | Amount < ₹50 on ONLINE channel | 0.85 |
| odd_hours | Transaction between 1am–4am | 0.30 |
| international_high_amount | International + amount > ₹50,000 | 0.75 |
| refund_abuse | Refund > ₹10,000 | 0.60 |
| velocity | >10 transactions per account in 60s | 0.90 |

**Recommendations:**
- Score ≥ 0.80 → `BLOCK`
- Score ≥ 0.50 → `REVIEW`
- Score < 0.50 → `APPROVE`

---

## Data Model

Every transaction contains:
transaction_id      UUID (primary key)
timestamp           UTC datetime
account_id          Synthetic account identifier
account_number      Masked (XXXX-XXXX-XXXX-1234)
account_type        SAVINGS | CURRENT | CREDIT
transaction_type    PURCHASE | ATM_WITHDRAWAL | ONLINE_TRANSFER
BILL_PAYMENT | REFUND | INTERNATIONAL
amount              INR (log-normal distribution)
currency            INR | USD | GBP | EUR | SGD | AED
merchant_id         Hashed merchant identifier
merchant_name       Realistic Indian merchant names
merchant_category   12 categories (GROCERY, FUEL, TRAVEL...)
location            country, city, latitude, longitude
channel             POS | ATM | ONLINE | MOBILE
is_international    Boolean
is_high_value       Boolean
is_suspicious       Boolean
fraud_score         0.0 – 1.0
status              PENDING | APPROVED | DECLINED | FLAGGED

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|---|---|---|
| POSTGRES_HOST | localhost | PostgreSQL host |
| POSTGRES_DB | finflow | Database name |
| REDIS_HOST | localhost | Redis host |
| FRAUD_RATE | 0.02 | Fraud injection rate (0.0–1.0) |
| USE_MOCK_NOTIFIER | true | Use console alerts instead of SNS |
| AWS_DEFAULT_REGION | ap-south-1 | AWS region |
| KINESIS_STREAM_NAME | finflow-transactions | Kinesis stream |

---

## Roadmap

- [x] Transaction generator with realistic Indian banking data
- [x] Rule-based fraud detection microservice
- [x] Alert notification microservice (Mock + AWS SNS)
- [x] REST API gateway with full pipeline orchestration
- [x] PostgreSQL persistence (transactions + fraud alerts)
- [x] Redis deduplication + velocity tracking
- [ ] AWS infrastructure via Terraform (Kinesis, Lambda, S3, SNS)
- [ ] Prometheus + Grafana monitoring dashboards
- [ ] k3s deployment on homelab
- [ ] GitHub Actions CI/CD pipeline
- [ ] pytest test suite

---

## License

MIT