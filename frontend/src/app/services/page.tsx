'use client';

import { RefreshCw } from 'lucide-react';
import { usePolling } from '@/hooks/usePolling';
import { fetchAPI } from '@/lib/api';

interface ServiceHealth {
  name: string;
  status: string;
  latency: number;
  data: Record<string, unknown>;
}

export default function ServicesPage() {
  const { data, isLoading, refetch } = usePolling<{
    services: ServiceHealth[];
    overall: string;
    timestamp: string;
  }>(
    () => fetchAPI('/api/health'),
    { interval: 15_000 }
  );

  const services = data?.services || [];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>Service Health</h1>
            <p>Live health status of all pipeline components</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {data && (
              <span style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: data.overall === 'healthy' ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: data.overall === 'healthy' ? 'var(--success)' : 'var(--danger)',
                textTransform: 'uppercase',
              }}>
                {data.overall}
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={refetch}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid-3">
        {isLoading && !services.length
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card" style={{ height: 180 }}>
                <div className="skeleton" style={{ width: '60%', height: 20, marginBottom: 16 }} />
                <div className="skeleton" style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px' }} />
                <div className="skeleton" style={{ width: '50%', height: 14, margin: '0 auto' }} />
              </div>
            ))
          : services.map((svc) => (
              <div key={svc.name} className="glass-card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                {/* Background glow */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: svc.status === 'healthy' ? 'var(--success)' : 'var(--danger)',
                  opacity: 0.04,
                  filter: 'blur(30px)',
                }} />

                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 16 }}>
                  {svc.name}
                </div>

                {/* Status indicator */}
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: svc.status === 'healthy' ? 'var(--success-bg)' : 'var(--danger-bg)',
                    border: `2px solid ${svc.status === 'healthy' ? 'var(--success)' : 'var(--danger)'}`,
                    animation: svc.status === 'healthy' ? 'pulse-subtle 3s infinite' : 'none',
                  }}>
                    <div className={`health-dot ${svc.status === 'healthy' ? 'healthy' : 'unhealthy'}`}
                         style={{ width: 16, height: 16 }} />
                  </div>
                </div>

                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: svc.status === 'healthy' ? 'var(--success)' : 'var(--danger)',
                  marginBottom: 8,
                }}>
                  {svc.status}
                </div>

                {svc.latency > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>
                    {svc.latency}ms response
                  </div>
                )}

                {/* Extra data from health endpoint */}
                {svc.data && Object.keys(svc.data).length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-2)', textAlign: 'left' }}>
                    {Object.entries(svc.data).map(([key, val]) => (
                      key !== 'status' && (
                        <div key={key} style={{
                          display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem',
                          padding: '3px 0', color: 'var(--text-3)',
                        }}>
                          <span>{key}</span>
                          <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>
                            {typeof val === 'boolean' ? (val ? '✓' : '✗') : String(val)}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            ))
        }
      </div>
    </div>
  );
}
