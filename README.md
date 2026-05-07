# FinFlow — Banking Transaction Data Pipeline

A production-grade ETL pipeline simulating real-world banking 
transaction data flows across stream ingestion, fraud detection, 
multi-layer storage, and real-time monitoring.

## Stack
- Python, FastAPI, PostgreSQL, Redis
- AWS: Kinesis, Lambda, S3, SNS, CloudWatch
- Monitoring: Prometheus, Grafana
- Deploy: Docker, k3s, GitHub Actions, Terraform

## Services
| Service               | Port |
|-----------------------|------|
| api_gateway           | 8000 |
| fraud_service         | 8001 |
| notification_service  | 8002 |

## Quick Start
    cp .env.example .env
    docker-compose up -d
    python generator/main.py --mode local --tps 10
