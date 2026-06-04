const BASE = '';

export async function fetchAPI<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API Error ${res.status}: ${body}`);
  }

  return res.json();
}

export async function fetchPrometheus(
  query: string,
  params?: {
    start?: number;
    end?: number;
    step?: number;
    time?: number;
  }
): Promise<unknown> {
  const searchParams = new URLSearchParams();
  searchParams.set('query', query);

  if (params?.start && params?.end) {
    searchParams.set('start', params.start.toString());
    searchParams.set('end', params.end.toString());
    searchParams.set('step', (params.step || 15).toString());
    const url = `/api/metrics?type=range&${searchParams.toString()}`;
    return fetchAPI(url);
  }

  if (params?.time) {
    searchParams.set('time', params.time.toString());
  }
  const url = `/api/metrics?type=instant&${searchParams.toString()}`;
  return fetchAPI(url);
}
