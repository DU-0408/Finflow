# FinFlow Kubernetes Manifests

## Setup Before Deploying

1. Copy example files and fill in your values:
```bash
   cp secret-example.yaml secret.yaml
   cp configmap-example.yaml configmap.yaml
```

2. Edit `secret.yaml` with your real credentials

3. Edit `configmap.yaml` with your AWS account ID and other values

4. Apply in this order:
```bash
   kubectl apply -f namespace.yaml
   kubectl apply -f secret.yaml
   kubectl apply -f configmap.yaml
   kubectl apply -f postgres.yaml
   kubectl apply -f redis.yaml
   kubectl apply -f fraud-service.yaml
   kubectl apply -f notification-service.yaml
   kubectl apply -f api-gateway.yaml
   kubectl apply -f generator.yaml
   kubectl apply -f monitoring.yaml
```

## Files

| File | Committed | Description |
|---|---|---|
| namespace.yaml | ✅ | Namespace definition |
| secret-example.yaml | ✅ | Template for secrets |
| secret.yaml | ❌ gitignored | Your actual secrets |
| configmap-example.yaml | ✅ | Template for config |
| configmap.yaml | ❌ gitignored | Your actual config |
| postgres.yaml | ✅ | PostgreSQL deployment |
| redis.yaml | ✅ | Redis deployment |
| fraud-service.yaml | ✅ | Fraud detection service |
| notification-service.yaml | ✅ | Notification service |
| api-gateway.yaml | ✅ | API gateway |
| generator.yaml | ✅ | Transaction generator |
| monitoring.yaml | ✅ | Prometheus + Grafana |

## Notes
- Never commit secret.yaml or configmap.yaml
- YOUR_ACCOUNT_ID = your 12-digit AWS account ID
- YOUR_POSTGRES_PASSWORD = strong password of your choice