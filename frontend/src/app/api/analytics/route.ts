import { NextResponse } from 'next/server';

type AnalyticsCategory = 'engagement' | 'share' | 'analysis' | 'error' | 'performance';
type AnalyticsEvent = {
  category: AnalyticsCategory;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

function isValidEvent(event: unknown) {
  if (!event || typeof event !== 'object') return false;
  const e = event as Partial<AnalyticsEvent>;
  const allowed: AnalyticsCategory[] = ['engagement', 'share', 'analysis', 'error', 'performance'];
  return !!e.category && allowed.includes(e.category) && typeof e.action === 'string';
}

export async function POST(req: Request) {
  try {
    const event: unknown = await req.json();
    if (!isValidEvent(event)) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

