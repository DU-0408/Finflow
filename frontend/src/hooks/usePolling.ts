'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions = {}
) {
  const { interval = 10_000, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fetch failed'));
      // NOTE: We intentionally do NOT clear `data` here so the UI
      // keeps showing the last good result instead of flashing empty.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!enabled) return;

    fetchData();

    intervalRef.current = setInterval(fetchData, interval);

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        fetchData();
        intervalRef.current = setInterval(fetchData, interval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData, interval, enabled]);

  return { data, isLoading, error, refetch };
}
