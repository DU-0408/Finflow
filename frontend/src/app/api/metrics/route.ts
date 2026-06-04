import { NextRequest, NextResponse } from 'next/server';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type  = searchParams.get('type') || 'instant';
  const query = searchParams.get('query') || '';
  const start = searchParams.get('start');
  const end   = searchParams.get('end');
  const step  = searchParams.get('step') || '15';

  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  try {
    let url: string;
    if (type === 'range' && start && end) {
      const params = new URLSearchParams({ query, start, end, step });
      url = `${PROMETHEUS_URL}/api/v1/query_range?${params}`;
    } else {
      const params = new URLSearchParams({ query });
      url = `${PROMETHEUS_URL}/api/v1/query?${params}`;
    }

    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: String(error) },
      { status: 502 }
    );
  }
}
