'use client';

import { useState } from 'react';
import { FlaskConical, Play, Zap, Shield, TrendingUp, RotateCcw } from 'lucide-react';

const PRESETS = [
  { label: 'Normal Day', count: 100, fraudRate: 0.02, icon: TrendingUp, color: 'var(--success)' },
  { label: 'Fraud Spike', count: 50, fraudRate: 0.40, icon: Shield, color: 'var(--danger)' },
  { label: 'Stress Test', count: 500, fraudRate: 0.05, icon: Zap, color: 'var(--warning)' },
  { label: 'Clean Run', count: 50, fraudRate: 0.00, icon: RotateCcw, color: 'var(--info)' },
];

interface SimResult {
  total: number;
  processed: number;
  flagged: number;
  errors: number;
  fraud_rate_actual: number;
}

export default function SimulatePage() {
  const [count, setCount] = useState(10);
  const [fraudRate, setFraudRate] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [history, setHistory] = useState<(SimResult & { timestamp: string })[]>([]);

  const runSimulation = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/proxy/simulate?count=${count}&fraud_rate=${fraudRate / 100}`, { method: 'POST' });
      const data = await res.json();
      setResult(data);
      setHistory(prev => [{ ...data, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Simulation Lab</h1>
        <p>Generate synthetic transactions to test the pipeline</p>
      </div>

      <div className="grid-2-1" style={{ marginBottom: 'var(--space-xl)' }}>
        {/* Controls */}
        <div className="glass-card">
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Transaction Count
              </label>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>{count}</span>
            </div>
            <input
              type="range"
              className="slider"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.7rem', color: 'var(--text-4)' }}>
              <span>1</span><span>500</span>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fraud Rate
              </label>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: fraudRate >= 30 ? 'var(--danger)' : fraudRate >= 10 ? 'var(--warning)' : 'var(--success)' }}>
                {fraudRate}%
              </span>
            </div>
            <input
              type="range"
              className="slider"
              min={0}
              max={100}
              value={fraudRate}
              onChange={(e) => setFraudRate(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.7rem', color: 'var(--text-4)' }}>
              <span>0%</span><span>100%</span>
            </div>
          </div>

          {/* Presets */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Quick Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => { setCount(preset.count); setFraudRate(preset.fraudRate * 100); }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-1)',
                    background: 'var(--bg-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--text-2)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = preset.color; e.currentTarget.style.color = 'var(--text-1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                >
                  <preset.icon size={16} style={{ color: preset.color }} />
                  <div style={{ textAlign: 'left' }}>
                    <div>{preset.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{preset.count} txns · {preset.fraudRate * 100}%</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
            onClick={runSimulation}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Processing {count} transactions...
              </>
            ) : (
              <>
                <Play size={18} />
                Generate {count} Transactions
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="glass-card">
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-2)', marginBottom: 16 }}>
            Results
          </div>

          {!result && !loading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: 200, color: 'var(--text-4)', gap: 8,
            }}>
              <FlaskConical size={40} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '0.85rem' }}>Run a simulation to see results</span>
            </div>
          )}

          {loading && (
            <div className="loading-container" style={{ height: 200 }}>
              <div className="spinner spinner-lg" />
              <span>Processing...</span>
            </div>
          )}

          {result && !loading && (
            <div className="slide-up">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-2)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-1)' }}>{result.total}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>Total</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--success-bg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{result.processed}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>Processed</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{result.flagged}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>Flagged</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--warning-bg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{result.fraud_rate_actual}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>Fraud Rate</div>
                </div>
              </div>
              {result.errors > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.8rem' }}>
                  ⚠ {result.errors} errors occurred
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card">
          <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-2)', marginBottom: 12 }}>
            Recent Runs
          </div>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Total</th>
                  <th>Processed</th>
                  <th>Flagged</th>
                  <th>Fraud Rate</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-3)' }}>{run.timestamp}</td>
                    <td>{run.total}</td>
                    <td style={{ color: 'var(--success)' }}>{run.processed}</td>
                    <td style={{ color: 'var(--danger)' }}>{run.flagged}</td>
                    <td>{run.fraud_rate_actual}%</td>
                    <td>{run.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
