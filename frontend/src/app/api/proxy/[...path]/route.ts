import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:8000';

async function proxyFetch(target: string, init?: RequestInit) {
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(target, {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  return NextResponse.json(
    { error: String(lastError) },
    { status: 502 }
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${API_GATEWAY_URL}/${path.join('/')}${req.nextUrl.search}`;
  return proxyFetch(target);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${API_GATEWAY_URL}/${path.join('/')}${req.nextUrl.search}`;
  const body = await req.text();
  return proxyFetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}
