import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL       = process.env.API_GATEWAY_URL          || 'http://localhost:8000';
const FRAUD_SERVICE_URL     = process.env.FRAUD_SERVICE_URL        || 'http://localhost:8001';
const NOTIFICATION_URL      = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8002';
const PROMETHEUS_URL        = process.env.PROMETHEUS_URL           || 'http://localhost:9090';
const GRAFANA_URL           = process.env.GRAFANA_URL              || 'http://localhost:3000';

async function checkService(url: string, name: string) {
  try {
    const start = Date.now();
    const res = await fetch(`${url}/health`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    const latency = Date.now() - start;
    const data = await res.json().catch(() => ({}));
    return { name, status: 'healthy' as const, latency, data };
  } catch {
    return { name, status: 'unhealthy' as const, latency: 0, data: {} };
  }
}

async function checkSimple(url: string, name: string) {
  try {
    const start = Date.now();
    await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    const latency = Date.now() - start;
    return { name, status: 'healthy' as const, latency, data: {} };
  } catch {
    return { name, status: 'unhealthy' as const, latency: 0, data: {} };
  }
}

export async function GET() {
  const [gateway, fraud, notification, prometheus, grafana] = await Promise.all([
    checkService(API_GATEWAY_URL, 'API Gateway'),
    checkService(FRAUD_SERVICE_URL, 'Fraud Service'),
    checkService(NOTIFICATION_URL, 'Notification Service'),
    checkSimple(`${PROMETHEUS_URL}/-/healthy`, 'Prometheus'),
    checkSimple(`${GRAFANA_URL}/api/health`, 'Grafana'),
  ]);

  return NextResponse.json({
    services: [gateway, fraud, notification, prometheus, grafana],
    overall: [gateway, fraud, notification].every(s => s.status === 'healthy') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
  });
}
