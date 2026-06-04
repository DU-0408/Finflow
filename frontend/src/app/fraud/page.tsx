'use client';

import { ShieldAlert, Target, TrendingDown, BarChart3 } from 'lucide-react';
import StatCard from '@/components/StatCard';
import MetricChart from '@/components/MetricChart';
import StatusBadge from '@/components/StatusBadge';
import { usePolling } from '@/hooks/usePolling';
import { fetchAPI } from '@/lib/api';
import { formatINR, formatNumber, timeAgo, truncateId } from '@/lib/formatters';
import { PROMETHEUS_QUERIES, FRAUD_RULES } from '@/lib/constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface FraudAlert {
  id: number;
  transaction_id: string;
  account_id: string;
  amount: number;
  fraud_score: number;
  pattern: string;
  detected_at: string;
  resolved: boolean;
}

export default function FraudPage() {
  const { data: alertsData, isLoading } = usePolling<{ alerts: FraudAlert[] }>(
    () => fetchAPI('/api/proxy/fraud-alerts?limit=100'),
    { interval: 10_000 }
  );

  const alerts = alertsData?.alerts || [];

  // Compute stats
  const avgScore = alerts.length > 0
    ? alerts.reduce((sum, a) => sum + (a.fraud_score || 0), 0) / alerts.length
    : 0;

  const ruleCounts: Record<string, number> = {};
  for (const a of alerts) {
    if (a.pattern) ruleCounts[a.pattern] = (ruleCounts[a.pattern] || 0) + 1;
  }
  const topRule = Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])[0];

  const blockCount = alerts.filter(a => (a.fraud_score || 0) >= 0.8).length;
  const reviewCount = alerts.filter(a => (a.fraud_score || 0) >= 0.5 && (a.fraud_score || 0) < 0.8).length;

  const ruleChartData = Object.entries(ruleCounts)
    .map(([rule, count]) => ({
      name: FRAUD_RULES[rule]?.label || rule,
      count,
      color: FRAUD_RULES[rule]?.color || '#6b7280',
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <div className="page-header">
        <h1>Fraud Command Center</h1>
        <p>Fraud detection analytics and alert management</p>
      </div>

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
        <StatCard
          title="Total Alerts"
          value={formatNumber(alerts.length)}
          icon={ShieldAlert}
          accentColor="var(--danger)"
          loading={isLoading}
        />
        <StatCard
          title="Avg Fraud Score"
          value={`${(avgScore * 100).toFixed(1)}%`}
          icon={Target}
          accentColor="var(--warning)"
          loading={isLoading}
        />
        <StatCard
          title="Top Rule"
          value={topRule ? FRAUD_RULES[topRule[0]]?.label || topRule[0] : '—'}
          icon={TrendingDown}
          accentColor="var(--violet)"
          loading={isLoading}
        />
        <StatCard
          title="Block / Review"
          value={`${blockCount} / ${reviewCount}`}
          icon={BarChart3}
          accentColor="var(--orange)"
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid-1-1" style={{ marginBottom: 'var(--space-xl)' }}>
        <MetricChart
          title="Fraud Detection Rate"
          query={PROMETHEUS_QUERIES.fraudDetectionRate}
          color="hsl(0, 84%, 60%)"
          height={250}
        />

        {/* Rule Breakdown Bar Chart */}
        <div className="glass-card" style={{ height: 310 }}>
          <div style={{
            fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.03em', color: 'var(--text-2)', marginBottom: 12,
          }}>
            Rule Trigger Breakdown
          </div>
          {ruleChartData.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: '0.85rem' }}>
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={ruleChartData} layout="vertical" margin={{ left: 80, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fill: 'var(--text-4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-1)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                  {ruleChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Alerts Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-2)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
            Fraud Alerts ({alerts.length})
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Transaction</th>
              <th>Account</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Score</th>
              <th>Pattern</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                  ))}
                </tr>
              ))
            ) : alerts.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}>No fraud alerts yet</td></tr>
            ) : (
              alerts.map((alert) => (
                <tr key={alert.id || alert.transaction_id}>
                  <td style={{ color: 'var(--text-3)' }}>{timeAgo(alert.detected_at)}</td>
                  <td className="font-mono" style={{ fontSize: '0.8rem' }}>{truncateId(alert.transaction_id)}</td>
                  <td>{alert.account_id}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-1)' }}>{formatINR(alert.amount)}</td>
                  <td>
                    <div style={{
                      width: 48, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--bg-4)',
                      overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle', marginRight: 6,
                    }}>
                      <div style={{
                        width: `${(alert.fraud_score || 0) * 100}%`, height: '100%', borderRadius: 'var(--radius-full)',
                        background: (alert.fraud_score || 0) >= 0.8 ? 'var(--danger)' : (alert.fraud_score || 0) >= 0.5 ? 'var(--warning)' : 'var(--success)',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{((alert.fraud_score || 0) * 100).toFixed(0)}%</span>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: FRAUD_RULES[alert.pattern]?.color ? `${FRAUD_RULES[alert.pattern].color}18` : 'var(--bg-4)',
                      color: FRAUD_RULES[alert.pattern]?.color || 'var(--text-2)',
                    }}>
                      {FRAUD_RULES[alert.pattern]?.label || alert.pattern}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={(alert.fraud_score || 0) >= 0.8 ? 'BLOCK' : 'REVIEW'} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
