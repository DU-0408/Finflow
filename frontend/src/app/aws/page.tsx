'use client';

import { Cloud, Zap, HardDrive, Bell, AlertTriangle, RefreshCw } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { fetchAPI } from '@/lib/api';

interface KinesisData {
  stream: { name: string; status: string; shards: number; retention: number; arn: string; createdAt: string };
  metrics: { incomingRecords: number[]; incomingBytes: number[]; timestamps: string[] };
  error?: string;
}

interface LambdaData {
  function: { name: string; runtime: string; memory: number; timeout: number; handler: string; codeSize: number; lastModified: string; state: string };
  metrics: { invocations: number[]; errors: number[]; duration: number[]; timestamps: string[] };
  recentLogs: { timestamp: string; message: string }[];
  error?: string;
}

interface S3Data {
  bucket: { name: string; totalObjects: number; totalSize: number };
  recentFiles: { key: string; size: number; lastModified: string }[];
  lifecycle: { id: string; status: string; transitions: string[] }[];
  error?: string;
}

interface SNSData {
  topic: { name: string; arn: string; subscriptions: number; subscriptionsPending: number; displayName: string };
  metrics: { published: number[]; delivered: number[]; failed: number[]; timestamps: string[] };
  error?: string;
}

interface Alarm {
  name: string;
  state: string;
  description: string;
  metric: string;
  threshold: number;
  stateReason: string;
  stateUpdated: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function ServiceCard({ title, icon: Icon, color, loading, error, children }: {
  title: string; icon: React.ElementType; color: string; loading?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-card slide-up" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80,
        borderRadius: '50%', background: color, opacity: 0.06, filter: 'blur(20px)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          <Icon size={18} />
        </div>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-1)' }}>{title}</span>
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 16, width: `${70 + Math.random() * 30}%` }} />)}
        </div>
      ) : error ? (
        <div style={{ color: 'var(--text-4)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>
          <AlertTriangle size={20} style={{ marginBottom: 4, opacity: 0.4 }} /><br />
          Unable to connect — check AWS credentials
        </div>
      ) : children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-2)', fontSize: '0.8rem' }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}

export default function AWSPage() {
  const { data: kinesis, isLoading: kLoading } = usePolling<KinesisData>(() => fetchAPI('/api/aws/kinesis'), { interval: 30_000 });
  const { data: lambda, isLoading: lLoading } = usePolling<LambdaData>(() => fetchAPI('/api/aws/lambda'), { interval: 30_000 });
  const { data: s3, isLoading: sLoading } = usePolling<S3Data>(() => fetchAPI('/api/aws/s3'), { interval: 60_000 });
  const { data: sns, isLoading: snLoading } = usePolling<SNSData>(() => fetchAPI('/api/aws/sns'), { interval: 30_000 });
  const { data: alarmsData, isLoading: aLoading } = usePolling<{ alarms: Alarm[] }>(() => fetchAPI('/api/aws/alarms'), { interval: 30_000 });

  const alarms = alarmsData?.alarms || [];

  return (
    <div>
      <div className="page-header">
        <h1>AWS Infrastructure</h1>
        <p>Live status of Kinesis, Lambda, S3, SNS, and CloudWatch resources</p>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
        {/* Kinesis */}
        <ServiceCard title="Kinesis Data Stream" icon={Zap} color="hsl(25, 95%, 53%)" loading={kLoading} error={kinesis?.error}>
          <DataRow label="Stream" value={kinesis?.stream.name} />
          <DataRow label="Status" value={kinesis?.stream.status} />
          <DataRow label="Open Shards" value={kinesis?.stream.shards} />
          <DataRow label="Retention" value={kinesis?.stream.retention ? `${kinesis.stream.retention}h` : undefined} />
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>
              Recent throughput (5m buckets)
            </div>
            {kinesis?.metrics?.incomingRecords && kinesis.metrics.incomingRecords.some(v => v > 0) ? (
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 40 }}>
                {kinesis.metrics.incomingRecords.slice(-12).map((v, i) => (
                  <div key={i} style={{
                    flex: 1, background: 'hsl(25, 95%, 53%)', borderRadius: '2px 2px 0 0', opacity: 0.6,
                    height: `${Math.max(4, (v / (Math.max(...kinesis.metrics.incomingRecords) || 1)) * 40)}px`,
                  }} />
                ))}
              </div>
            ) : (
              <div style={{
                height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-0)',
                fontSize: '0.72rem', color: 'var(--text-4)',
              }}>
                Stream idle — generator running in batch mode
              </div>
            )}
          </div>
        </ServiceCard>

        {/* Lambda */}
        <ServiceCard title="Lambda Function" icon={Cloud} color="hsl(263, 70%, 58%)" loading={lLoading} error={lambda?.error}>
          <DataRow label="Function" value={lambda?.function.name} />
          <DataRow label="Runtime" value={lambda?.function.runtime} />
          <DataRow label="Memory" value={lambda?.function.memory ? `${lambda.function.memory} MB` : undefined} />
          <DataRow label="Timeout" value={lambda?.function.timeout ? `${lambda.function.timeout}s` : undefined} />
          <DataRow label="State" value={lambda?.function.state} />
          <DataRow label="Code Size" value={lambda?.function.codeSize ? formatBytes(lambda.function.codeSize) : undefined} />
          {lambda?.recentLogs && lambda.recentLogs.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>
                Recent Logs
              </div>
              <div style={{ maxHeight: 120, overflow: 'auto', background: 'var(--bg-0)', borderRadius: 'var(--radius-sm)', padding: 8, fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-3)' }}>
                {lambda.recentLogs.slice(0, 8).map((log, i) => (
                  <div key={i} style={{ marginBottom: 2, lineHeight: 1.4 }}>{log.message}</div>
                ))}
              </div>
            </div>
          )}
        </ServiceCard>
      </div>

      <div className="grid-2" style={{ marginBottom: 'var(--space-lg)' }}>
        {/* S3 */}
        <ServiceCard title="S3 Data Lake" icon={HardDrive} color="hsl(152, 69%, 45%)" loading={sLoading} error={s3?.error}>
          <DataRow label="Bucket" value={s3?.bucket.name} />
          <DataRow label="Objects" value={s3?.bucket.totalObjects} />
          <DataRow label="Total Size" value={s3?.bucket.totalSize ? formatBytes(s3.bucket.totalSize) : undefined} />
          {s3?.lifecycle && s3.lifecycle.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>Lifecycle Rules</div>
              {s3.lifecycle.map((rule, i) => (
                <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-3)', padding: '2px 0' }}>
                  {rule.transitions.join(', ')}
                </div>
              ))}
            </div>
          )}
          {s3?.recentFiles && s3.recentFiles.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>Recent Files</div>
              {s3.recentFiles.slice(0, 5).map((file, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-3)', padding: '2px 0' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{file.key}</span>
                  <span style={{ color: 'var(--text-4)' }}>{formatBytes(file.size)}</span>
                </div>
              ))}
            </div>
          )}
        </ServiceCard>

        {/* SNS */}
        <ServiceCard title="SNS Alerts" icon={Bell} color="hsl(199, 89%, 48%)" loading={snLoading} error={sns?.error}>
          <DataRow label="Topic" value={sns?.topic.name} />
          <DataRow label="Subscriptions" value={sns?.topic.subscriptions} />
          <DataRow label="Pending" value={sns?.topic.subscriptionsPending} />
          {sns?.metrics.published && sns.metrics.published.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>
                Messages Published (5m buckets)
              </div>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 40 }}>
                {sns.metrics.published.slice(-12).map((v, i) => (
                  <div key={i} style={{
                    flex: 1, background: 'hsl(199, 89%, 48%)', borderRadius: '2px 2px 0 0', opacity: 0.6,
                    height: `${Math.max(4, (v / (Math.max(...sns.metrics.published) || 1)) * 40)}px`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </ServiceCard>
      </div>

      {/* CloudWatch Alarms */}
      <div className="glass-card">
        <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-2)', marginBottom: 16 }}>
          CloudWatch Alarms
        </div>
        {aLoading ? (
          <div style={{ display: 'flex', gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, flex: 1, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : alarms.length === 0 ? (
          <div style={{ color: 'var(--text-4)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
            No alarms configured or unable to fetch — check AWS credentials
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(alarms.length, 3)}, 1fr)`, gap: 12 }}>
            {alarms.map((alarm) => {
              const stateColor = alarm.state === 'OK' ? 'var(--success)' : alarm.state === 'ALARM' ? 'var(--danger)' : 'var(--text-4)';
              const stateBg = alarm.state === 'OK' ? 'var(--success-bg)' : alarm.state === 'ALARM' ? 'var(--danger-bg)' : 'var(--bg-3)';
              return (
                <div key={alarm.name} style={{
                  padding: 16, borderRadius: 'var(--radius-md)',
                  background: stateBg, border: `1px solid color-mix(in srgb, ${stateColor} 20%, transparent)`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)' }}>
                      {alarm.name?.replace('finflow-', '').replace(/-/g, ' ')}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.65rem',
                      fontWeight: 700, background: stateColor, color: 'white', textTransform: 'uppercase',
                    }}>
                      {alarm.state}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 4 }}>
                    {alarm.metric} {alarm.threshold !== undefined ? `> ${alarm.threshold}` : ''}
                  </div>
                  {alarm.stateUpdated && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-4)' }}>
                      Updated: {new Date(alarm.stateUpdated).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
