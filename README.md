<div align="center">

# FinFlow

### Real-Time Banking Transaction Data Pipeline

A production-grade data pipeline that simulates, processes, and monitors banking transactions
in real time — featuring fraud detection, multi-layer storage, AWS streaming, and a live operations dashboard.

[![CI/CD](https://github.com/du-0408/FinFlow/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/du-0408/FinFlow/actions/workflows/ci-cd.yml)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://python.org)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[Live Dashboard](https://finflow.udhomelab.dpdns.org)** · **[API Docs](https://finflow.udhomelab.dpdns.org/api/proxy/docs)** · **[Architecture](#architecture)**

</div>

---

## Overview

FinFlow is an end-to-end banking transaction data pipeline built to demonstrate enterprise-level data engineering, real-time fraud detection, cloud infrastructure, and full-stack observability. It generates realistic synthetic Indian banking transactions, runs them through a fraud detection engine, stores results across multiple layers, streams data to AWS, and presents everything through a live Next.js dashboard.

**Key capabilities:**
- 🔄 **Transaction Generation** — Configurable synthetic data generator producing realistic Indian banking transactions at 10–100+ TPS
- 🛡️ **Fraud Detection** — 7-rule scoring engine analyzing velocity, geolocation, amount patterns, and temporal anomalies
- ☁️ **AWS Pipeline** — Dual-write to both PostgreSQL and AWS Kinesis → Lambda → S3 data lake
- 📊 **Live Dashboard** — Real-time Next.js operations dashboard with WebSocket feeds, Prometheus metrics, and drill-down views
- 🏗️ **Infrastructure as Code** — Terraform for AWS resources, K8s manifests for homelab deployment, CI/CD via GitHub Actions

---

## Architecture

```
                          ┌─────────────────────────────────┐
                          │     Transaction Generator       │
                          │  (Faker · 10–100 TPS · Indian)  │
                          └───────────┬─────────┬───────────┘
                          Dual Write  │         │
                    ┌─────────────────┘         └──────────────────┐
                    ▼                                              ▼
          ┌─────────────────┐                          ┌──────────────────┐
          │   API Gateway   │                          │  AWS Kinesis     │
          │   (FastAPI)     │                          │  Data Stream     │
          │   :8000         │                          └────────┬─────────┘
          └──┬──────┬───────┘                                   │
             │      │                                           ▼
             │      │                                 ┌──────────────────┐
             │      ├──────────────────┐              │   AWS Lambda     │
             │      │                  │              │  (Processor)     │
             ▼      ▼                  ▼              └────────┬─────────┘
    ┌──────────┐  ┌──────────┐  ┌────────────┐                │
    │PostgreSQL│  │  Redis   │  │   Fraud    │                ▼
    │(Ledger)  │  │ (Cache)  │  │  Service   │      ┌──────────────────┐
    └──────────┘  └──────────┘  │   :8001    │      │     AWS S3       │
                                └──────┬─────┘      │   (Data Lake)    │
                                       │            └──────────────────┘
                                       ▼
                              ┌────────────────┐
                              │  Notification  │
                              │   Service      │──── AWS SNS
                              │   :8002        │
                              └────────────────┘

          ┌─────────────────────────────────────────────┐
          │         Monitoring & Observability           │
          │  Prometheus (:9090) · Grafana (:3000)        │
          └─────────────────────────────────────────────┘

          ┌─────────────────────────────────────────────┐
          │         Next.js Dashboard (:3001)            │
          │  Overview · Transactions · Fraud Center      │
          │  Monitoring · AWS Infra · Simulate           │
          └─────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, FastAPI, Pydantic, psycopg2, httpx |
| **Frontend** | Next.js 15, React 19, TypeScript, Recharts, NextAuth.js |
| **Database** | PostgreSQL 15, Redis 7 |
| **Cloud** | AWS Kinesis, Lambda, S3, SNS, CloudWatch |
| **Monitoring** | Prometheus, Grafana |
| **Infrastructure** | Terraform, Docker, Kubernetes (k3s) |
| **CI/CD** | GitHub Actions (lint → test → build → push → deploy) |
| **Data** | Faker (Indian locale), Pydantic models |

---

## Services

| Service | Port | Description |
|---|---|---|
| **API Gateway** | 8000 | Central orchestrator — receives, validates, routes transactions through the pipeline |
| **Fraud Service** | 8001 | Rule-based fraud scoring engine (7 independent rules, 0.0–1.0 score) |
| **Notification Service** | 8002 | Alert dispatcher — AWS SNS in production, console mock for development |
| **Generator** | 8003 | Synthetic transaction generator with Prometheus metrics endpoint |
| **Frontend** | 3001 | Next.js operations dashboard with real-time WebSocket feeds |
| **PostgreSQL** | 5432 | Transaction ledger, fraud alerts, user accounts |
| **Redis** | 6379 | Deduplication cache, velocity tracking, session store |
| **Prometheus** | 9090 | Metrics aggregation and storage |
| **Grafana** | 3000 | Monitoring dashboards and alerting |

---

## Project Structure

```
finflow/
├── api_gateway/
│   ├── main.py              # FastAPI app — routes, WebSocket, auth
│   ├── pipeline.py          # Transaction orchestration (validate → fraud → store → notify)
│   └── middleware.py        # Request logging, Prometheus counters
├── fraud_service/
│   ├── main.py              # Fraud detection API
│   ├── rules.py             # 7-rule scoring engine
│   └── metrics.py           # Prometheus fraud counters
├── notification_service/
│   ├── main.py              # Alert dispatch API
│   └── notifier.py          # SNSNotifier + MockNotifier
├── generator/
│   ├── main.py              # CLI entry (--mode local|batch|stream|dual)
│   ├── factory.py           # TransactionFactory (Faker, Indian locale)
│   ├── producers.py         # KinesisProducer, APIProducer, DualProducer, LocalProducer
│   ├── models.py            # Pydantic data models (Transaction, enums)
│   ├── db.py                # Thread-safe PostgreSQL manager
│   └── cache.py             # Redis deduplication + velocity tracking
├── frontend/
│   ├── src/app/             # Next.js pages (Overview, Transactions, Fraud, AWS, etc.)
│   ├── src/components/      # Reusable UI components (StatCard, MetricChart, etc.)
│   ├── src/hooks/           # React hooks (usePolling, useWebSocket, usePrometheus)
│   ├── src/lib/             # Utilities (api, formatters, constants, auth)
│   └── Dockerfile           # Multi-stage build (deps → build → standalone)
├── infrastructure/
│   ├── terraform/           # AWS provisioning (Kinesis, Lambda, S3, SNS, CloudWatch)
│   └── k8s/                 # Kubernetes manifests (Deployments, Services, ConfigMaps)
├── monitoring/
│   ├── prometheus/          # Scrape configuration
│   └── grafana/             # Dashboard JSON + provisioning
├── tests/                   # pytest test suite
├── .github/workflows/       # CI/CD pipeline
├── docker-compose.yml       # Local development stack
└── requirements.txt         # Python dependencies
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Docker Desktop
- Git
- Node.js 20+ (for frontend development only)

### 1. Clone and configure

```bash
git clone https://github.com/du-0408/FinFlow.git
cd FinFlow
cp .env.example .env          # Edit with your values
```

### 2. Start the full stack

```bash
docker compose up --build -d
```

This starts all 10 services: PostgreSQL, Redis, API Gateway, Fraud Service, Notification Service, Generator, Frontend, Prometheus, and Grafana.

### 3. Access the dashboard

Open **http://localhost:3001** and log in with the credentials configured in your `.env` file (default: `admin` / `admin123`).

### 4. Verify the pipeline

```bash
# Check service health
curl http://localhost:8000/health

# View pipeline stats
curl http://localhost:8000/stats

# View fraud alerts
curl http://localhost:8000/fraud-alerts
```

---

## Generator Modes

The transaction generator supports four operating modes:

| Mode | Command | Data Flow | Use Case |
|---|---|---|---|
| `local` | `--mode local` | Console output only | Development, testing |
| `batch` | `--mode batch` | Generator → API Gateway → PostgreSQL | Dashboard-only deployment |
| `stream` | `--mode stream` | Generator → AWS Kinesis | AWS pipeline only |
| **`dual`** | `--mode dual` | Generator → API Gateway + Kinesis | **Production** (both dashboard and AWS) |

```bash
# Local development
python -m generator.main --mode local --tps 10 --duration 60

# Production (dual-write)
python -m generator.main --mode dual --tps 10 --batch-size 50
```

Set the mode via the `GENERATOR_MODE` environment variable in Docker Compose or K8s ConfigMap.

---

## Fraud Detection Engine

Seven independent rules score each transaction from 0.0 to 1.0. The final fraud score is the **maximum** across all rules.

| Rule | Trigger | Score |
|---|---|---|
| **High Value** | Amount > ₹1,00,000 | 0.70 |
| **Geo Anomaly** | Transaction from high-risk country | 0.85 |
| **Card Testing** | Amount < ₹50 on ONLINE channel | 0.85 |
| **Odd Hours** | Between 1:00 AM – 4:00 AM | 0.30 |
| **International High** | International + amount > ₹50,000 | 0.75 |
| **Refund Abuse** | Refund > ₹10,000 | 0.60 |
| **Velocity** | >10 transactions per account in 60s | 0.90 |

**Decision thresholds:**

| Score | Action | Status |
|---|---|---|
| ≥ 0.80 | Block + Alert (SNS) | `FLAGGED` |
| ≥ 0.50 | Review queue | `FLAGGED` |
| < 0.50 | Auto-approve | `APPROVED` |

---

## Dashboard

The Next.js operations dashboard provides six views:

| Page | Features |
|---|---|
| **Overview** | Live stat cards, TPS chart (Prometheus), recent fraud alerts, service health |
| **Transactions** | Paginated transaction table, real-time WebSocket feed, search/filter, detail drawer |
| **Fraud Center** | Fraud alert management, score distribution, pattern analysis |
| **Monitoring** | Prometheus metric charts, latency histograms, error rates |
| **AWS Infra** | Kinesis throughput, Lambda invocations, S3 data lake, SNS alerts, CloudWatch alarms |
| **Simulate** | On-demand transaction generation with configurable fraud rate |

---

## Deployment

### Docker Compose (Local)

```bash
docker compose up --build -d
```

### Kubernetes (k3s Homelab)

The production deployment runs on a k3s cluster with Cloudflare Tunnel for external access.

```bash
# Apply all manifests
kubectl apply -f infrastructure/k8s/namespace.yaml
kubectl apply -f infrastructure/k8s/configmap.yaml
kubectl apply -f infrastructure/k8s/secret.yaml
kubectl apply -f infrastructure/k8s/postgres.yaml
kubectl apply -f infrastructure/k8s/redis.yaml
kubectl apply -f infrastructure/k8s/monitoring.yaml
kubectl apply -f infrastructure/k8s/fraud-service.yaml
kubectl apply -f infrastructure/k8s/notification-service.yaml
kubectl apply -f infrastructure/k8s/api-gateway.yaml
kubectl apply -f infrastructure/k8s/generator.yaml
kubectl apply -f infrastructure/k8s/frontend.yaml

# Verify
kubectl get pods -n finflow
```

**Cloudflare Tunnel setup:**

```bash
cloudflared tunnel create finflow
cloudflared tunnel route dns finflow finflow.udhomelab.dpdns.org
# Configure tunnel ingress to point to finflow-frontend:3001
```

### AWS Infrastructure

AWS resources are provisioned via Terraform:

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars   # Edit with your values
terraform init
terraform plan
terraform apply
```

This creates: Kinesis Data Stream, Lambda Function, S3 Bucket, SNS Topic, CloudWatch Alarms, and IAM roles.

---

## CI/CD Pipeline

The GitHub Actions pipeline runs on every push to `main`:

```
Push to main
    │
    ▼
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│   CI    │────▶│  Build &     │────▶│  Deploy to   │
│ Lint +  │     │  Push to     │     │  k3s via     │
│  Test   │     │  Docker Hub  │     │  self-hosted │
└─────────┘     └──────────────┘     │  runner      │
                                     └──────────────┘
```

- **CI**: ruff linting, pytest suite (with PostgreSQL + Redis service containers)
- **Build**: Multi-arch Docker images (amd64 + arm64) pushed to Docker Hub
- **Deploy**: Rolling updates via `kubectl set image` on the self-hosted k3s runner

---

## API Reference

Interactive Swagger documentation is available at:

| Service | URL |
|---|---|
| API Gateway | `http://localhost:8000/docs` |
| Fraud Service | `http://localhost:8001/docs` |
| Notification Service | `http://localhost:8002/docs` |

### Key Endpoints

```bash
# Pipeline stats
GET /stats

# Paginated transactions (with total count)
GET /transactions?limit=30&offset=0

# Fraud alerts
GET /fraud-alerts?limit=50

# Single transaction detail
GET /transactions/{transaction_id}

# Simulate transactions (demo)
POST /simulate?count=20&fraud_rate=0.2

# Submit a batch
POST /transactions/batch
```

---

## Data Model

Each transaction contains 25+ fields modeled after real banking systems:

| Field | Type | Description |
|---|---|---|
| `transaction_id` | UUID | Primary key |
| `timestamp` | DateTime | UTC transaction time |
| `account_id` | String | Synthetic account identifier |
| `account_number` | String | Masked (XXXX-XXXX-XXXX-1234) |
| `account_type` | Enum | SAVINGS, CURRENT, CREDIT |
| `transaction_type` | Enum | PURCHASE, ATM_WITHDRAWAL, ONLINE_TRANSFER, BILL_PAYMENT, REFUND, INTERNATIONAL |
| `amount` | Decimal | INR (log-normal distribution) |
| `currency` | String | INR, USD, GBP, EUR, SGD, AED |
| `merchant_name` | String | Realistic Indian merchant names |
| `merchant_category` | Enum | 12 categories (GROCERY, FUEL, TRAVEL, etc.) |
| `location` | Object | country, city, latitude, longitude |
| `channel` | String | POS, ATM, ONLINE, MOBILE |
| `fraud_score` | Float | 0.0 – 1.0 (from fraud engine) |
| `status` | Enum | PENDING → APPROVED / FLAGGED |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_HOST` | localhost | PostgreSQL host |
| `POSTGRES_DB` | finflow | Database name |
| `POSTGRES_PASSWORD` | changeme | Database password |
| `REDIS_HOST` | localhost | Redis host |
| `GENERATOR_MODE` | local | Generator mode: `local`, `batch`, `stream`, `dual` |
| `GENERATOR_TPS` | 10 | Transactions per second |
| `FRAUD_RATE` | 0.02 | Fraud injection rate (0.0–1.0) |
| `USE_MOCK_NOTIFIER` | true | Use console alerts instead of SNS |
| `ADMIN_USERNAME` | admin | Dashboard admin username |
| `ADMIN_PASSWORD` | admin123 | Dashboard admin password |
| `NEXTAUTH_SECRET` | — | JWT signing secret (required in production) |
| `AWS_DEFAULT_REGION` | ap-south-1 | AWS region |
| `KINESIS_STREAM_NAME` | finflow-transactions | Kinesis stream name |

---

## License

MIT