'use client';

import { Banknote, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/StatCard';
import MetricChart from '@/components/MetricChart';
import { usePolling } from '@/hooks/usePolling';
import { fetchAPI } from '@/lib/api';
import { formatINRCompact, formatNumber, formatINR } from '@/lib/formatters';
import { PROMETHEUS_QUERIES } from '@/lib/constants';

interface Stats {
  total: number;
  fraud_count: number;
  high_value_count: number;
  avg_amount: number;
  max_amount: number;
  total_volume: number;
}

interface FraudAlert {
  transaction_id: string;
  account_id: string;
  amount: number;
  fraud_score: number;
  pattern: string;
  detected_at: string;
}

export default function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = usePolling<Stats>(
    () => fetchAPI('/api/proxy/stats'),
    { interval: 10_000 }
  );

  const { data: alertsData, isLoading: alertsLoading } = usePolling<{ count: number; alerts: FraudAlert[] }>(
    () => fetchAPI('/api/proxy/fraud-alerts?limit=5'),
    { interval: 10_000 }
  );

  const { data: health } = usePolling<{ services: { name: string; status: string }[] }>(
    () => fetchAPI('/api/health'),
    { interval: 15_000 }
  );

  const fraudRate = stats && stats.total > 0
    ? ((stats.fraud_count / stats.total) * 100).toFixed(1) + '%'
    : stats ? '0%' : '—';

  // Safe accessor for alerts — handles null, undefined, and malformed responses
  const alerts = Array.isArray(alertsData?.alerts)
    ? alertsData.alerts.filter((a): a is FraudAlert =>
        a != null && typeof a.transaction_id === 'string' && typeof a.amount === 'number'
      )
    : [];

  return (
    <div>
      <div className="page-header">
        <h1>Overview</h1>
        <p>Real-time pipeline health and transaction metrics</p>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
        <StatCard
          title="Total Transactions"
          value={stats ? formatNumber(stats.total) : '—'}
          icon={TrendingUp}
          accentColor="var(--primary)"
          loading={statsLoading}
        />
        <StatCard
          title="Fraud Detected"
          value={stats ? formatNumber(stats.fraud_count) : '—'}
          icon={ShieldAlert}
          accentColor="var(--danger)"
          loading={statsLoading}
        />
        <StatCard
          title="Total Volume"
          value={stats ? formatINRCompact(stats.total_volume) : '—'}
          icon={Banknote}
          accentColor="var(--success)"
          loading={statsLoading}
        />
        <StatCard
          title="Fraud Rate"
          value={fraudRate}
          icon={AlertTriangle}
          accentColor="var(--warning)"
          loading={statsLoading}
        />
      </div>

      {/* Charts + Recent Alerts */}
      <div className="grid-2-1" style={{ marginBottom: 'var(--space-xl)' }}>
        <MetricChart
          title="Transactions Per Second"
          query={PROMETHEUS_QUERIES.tps}
          color="hsl(217, 91%, 60%)"
          height={280}
        />

        {/* Recent Fraud Alerts */}
        <div className="glass-card" style={{ height: 340, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.03em', color: 'var(--text-2)', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse-glow 2s infinite' }} />
            Recent Fraud Alerts
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {alertsLoading && alerts.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 'var(--radius-sm)' }} />
              ))
            ) : alerts.length === 0 ? (
              <div style={{ color: 'var(--text-4)', fontSize: '0.85rem', textAlign: 'center', paddingTop: 40 }}>
                No recent alerts
              </div>
            ) : (
              alerts.map((alert) => {
                const score = typeof alert.fraud_score === 'number' ? alert.fraud_score : 0;
                const amount = typeof alert.amount === 'number' ? alert.amount : 0;
                const pattern = alert.pattern || 'unknown';
                const detectedAt = alert.detected_at ? safeTimeAgo(alert.detected_at) : 'recently';

                return (
                  <div key={alert.transaction_id} style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    borderBottom: '1px solid var(--border-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>
                        {formatINR(amount)}
                      </div>
                      <div style={{ color: 'var(--text-4)', fontSize: '0.72rem', marginTop: 2 }}>
                        {pattern} · {detectedAt}
                      </div>
                    </div>
                    <div style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: score >= 0.8 ? 'var(--danger-bg)' : 'var(--warning-bg)',
                      color: score >= 0.8 ? 'var(--danger)' : 'var(--warning)',
                    }}>
                      {(score * 100).toFixed(0)}%
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Service Health */}
      <div className="glass-card">
        <div style={{
          fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.03em', color: 'var(--text-2)', marginBottom: 16,
        }}>
          Service Health
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
          {health?.services?.map((svc) => (
            <div key={svc.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={`health-dot ${svc.status === 'healthy' ? 'healthy' : 'unhealthy'}`} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>{svc.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Safe timeAgo that won't return "NaN ago" for invalid dates */
function safeTimeAgo(date: string): string {
  const d = new Date(date).getTime();
  if (isNaN(d)) return 'recently';
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
