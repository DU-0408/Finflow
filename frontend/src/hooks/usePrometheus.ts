'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface PrometheusDataPoint {
  time: string;
  timestamp: number;
  value: number;
  label?: string;
}

interface UsePrometheusOptions {
  timeRange?: number;     // seconds
  step?: number;          // query resolution in seconds
  refreshInterval?: number;
  enabled?: boolean;
}

export function usePrometheus(
  query: string,
  options: UsePrometheusOptions = {}
) {
  const {
    timeRange = 1800,
    step = 15,
    refreshInterval = 30000,
    enabled = true,
  } = options;

  const [data, setData] = useState<PrometheusDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - timeRange;
      const params = new URLSearchParams({
        type: 'range',
        query,
        start: start.toString(),
        end: end.toString(),
        step: step.toString(),
      });

      const res = await fetch(`/api/metrics?${params}`);
      if (!res.ok) throw new Error(`Prometheus error: ${res.status}`);
      const json = await res.json();

      if (json.status === 'success' && json.data?.result) {
        const points: PrometheusDataPoint[] = [];
        for (const series of json.data.result) {
          const label = series.metric
            ? Object.entries(series.metric)
                .filter(([k]) => k !== '__name__')
                .map(([, v]) => v)
                .join(' ') || query
            : query;
          for (const [ts, val] of series.values || []) {
            points.push({
              timestamp: ts,
              time: new Date(ts * 1000).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
              value: parseFloat(val as string) || 0,
              label,
            });
          }
        }
        setData(points);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed'));
    } finally {
      setIsLoading(false);
    }
  }, [query, timeRange, step]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    intervalRef.current = setInterval(fetchData, refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval, enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

export function usePrometheusInstant(
  query: string,
  options: { refreshInterval?: number; enabled?: boolean } = {}
) {
  const { refreshInterval = 10000, enabled = true } = options;
  const [value, setValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ type: 'instant', query });
      const res = await fetch(`/api/metrics?${params}`);
      if (!res.ok) throw new Error(`Prometheus error: ${res.status}`);
      const json = await res.json();

      if (json.status === 'success' && json.data?.result?.[0]) {
        const val = parseFloat(json.data.result[0].value?.[1]) || 0;
        setValue(val);
      }
    } catch {
      // silent fail for instant queries
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    intervalRef.current = setInterval(fetchData, refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval, enabled]);

  return { value, isLoading, refetch: fetchData };
}
