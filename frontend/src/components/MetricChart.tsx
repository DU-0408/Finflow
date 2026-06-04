'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { usePrometheus } from '@/hooks/usePrometheus';

interface MetricChartProps {
  title: string;
  query: string;
  unit?: string;
  color?: string;
  timeRange?: number;
  refreshInterval?: number;
  height?: number;
}

export default function MetricChart({
  title, query, unit = '', color = 'hsl(217, 91%, 60%)',
  timeRange = 1800, refreshInterval = 30000, height = 250,
}: MetricChartProps) {
  const { data, isLoading, error } = usePrometheus(query, { timeRange, refreshInterval });

  return (
    <div className="glass-card" style={{ height: height + 60 }}>
      <div style={{
        fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)',
        marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.03em',
      }}>
        {title}
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ width: '100%', height: height - 20, borderRadius: 'var(--radius-md)' }} />
      ) : error || data.length === 0 ? (
        <div style={{
          height: height - 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-4)', fontSize: '0.85rem',
        }}>
          {error ? 'Failed to load' : 'No data available'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height - 20}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--text-4)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-2)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: 'var(--text-4)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => {
                if (unit === 's') return v < 1 ? `${(v * 1000).toFixed(0)}ms` : `${v.toFixed(1)}s`;
                if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
                return v.toFixed(v < 10 ? 2 : 0);
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border-1)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem',
                color: 'var(--text-1)',
              }}
              labelStyle={{ color: 'var(--text-3)' }}
              formatter={(v) => [`${Number(v).toFixed(4)} ${unit}`, '']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${title.replace(/\s/g, '')})`}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
