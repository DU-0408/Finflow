'use client';

import { useState } from 'react';
import MetricChart from '@/components/MetricChart';
import { PROMETHEUS_QUERIES, TIME_RANGES } from '@/lib/constants';

export default function MonitoringPage() {
  const [timeRange, setTimeRange] = useState(1800); // 30m default
  const [refreshInterval, setRefreshInterval] = useState(30000);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1>System Monitoring</h1>
            <p>Prometheus metrics — replaces Grafana dashboards</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-1)' }}>
              {TIME_RANGES.map((tr) => (
                <button
                  key={tr.value}
                  onClick={() => setTimeRange(tr.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: timeRange === tr.value ? 'var(--primary)' : 'var(--bg-2)',
                    color: timeRange === tr.value ? 'white' : 'var(--text-3)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {tr.label}
                </button>
              ))}
            </div>
            <select
              className="input select"
              style={{ width: 120, padding: '6px 10px', fontSize: '0.75rem' }}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={5000}>5s refresh</option>
              <option value={10000}>10s refresh</option>
              <option value={30000}>30s refresh</option>
              <option value={0}>Manual</option>
            </select>
          </div>
        </div>
      </div>

      {/* Row 1: TPS + Fraud Rate */}
      <div className="grid-1-1" style={{ marginBottom: 'var(--space-lg)' }}>
        <MetricChart
          title="Transactions Per Second"
          query={PROMETHEUS_QUERIES.tps}
          color="hsl(217, 91%, 60%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
        <MetricChart
          title="Fraud Detection Rate"
          query={PROMETHEUS_QUERIES.fraudDetectionRate}
          color="hsl(0, 84%, 60%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
      </div>

      {/* Row 2: Analysis Latency + Rules Triggered */}
      <div className="grid-1-1" style={{ marginBottom: 'var(--space-lg)' }}>
        <MetricChart
          title="Fraud Analysis Duration (P95)"
          query={PROMETHEUS_QUERIES.analysisP95}
          unit="s"
          color="hsl(263, 70%, 58%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
        <MetricChart
          title="Fraud Rules Triggered"
          query={PROMETHEUS_QUERIES.rulesTrigger}
          color="hsl(25, 95%, 53%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
      </div>

      {/* Row 3: API Gateway */}
      <div className="grid-1-1" style={{ marginBottom: 'var(--space-lg)' }}>
        <MetricChart
          title="API Gateway Request Rate"
          query={PROMETHEUS_QUERIES.apiRequestRate}
          color="hsl(152, 69%, 45%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
        <MetricChart
          title="API Response Time (P95)"
          query={PROMETHEUS_QUERIES.apiResponseP95}
          unit="s"
          color="hsl(38, 92%, 55%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
      </div>

      {/* Row 4: Alerts */}
      <div className="grid-1-1">
        <MetricChart
          title="Alerts Sent by Type"
          query={PROMETHEUS_QUERIES.alertsSent}
          color="hsl(199, 89%, 48%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
        <MetricChart
          title="Alert Failures"
          query={PROMETHEUS_QUERIES.alertsFailed}
          color="hsl(0, 84%, 60%)"
          timeRange={timeRange}
          refreshInterval={refreshInterval || 99999999}
        />
      </div>
    </div>
  );
}
