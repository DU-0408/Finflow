'use client';


import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  accentColor?: string;
  loading?: boolean;
}

export default function StatCard({ title, value, icon: Icon, trend, accentColor = 'var(--primary)', loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="glass-card" style={{ minHeight: 120 }}>
        <div className="skeleton" style={{ width: '40%', height: 14, marginBottom: 12 }} />
        <div className="skeleton" style={{ width: '60%', height: 32, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: '50%', height: 12 }} />
      </div>
    );
  }

  return (
    <div className="glass-card slide-up" style={{ minHeight: 120, position: 'relative', overflow: 'hidden' }}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: accentColor,
        opacity: 0.06,
        filter: 'blur(20px)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
            {value}
          </div>
          {trend && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 8,
              fontSize: '0.8rem',
              color: trend.value >= 0 ? 'var(--success)' : 'var(--danger)',
              fontWeight: 500,
            }}>
              <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%</span>
              <span style={{ color: 'var(--text-4)' }}>{trend.label}</span>
            </div>
          )}
        </div>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-md)',
          background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accentColor,
        }}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
