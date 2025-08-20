import { NextResponse } from 'next/server';

function isValidEvent(event: any) {
  if (!event || typeof event !== 'object') return false;
  const allowed = ['engagement', 'share', 'analysis', 'error', 'performance'];
  return allowed.includes(event.category) && typeof event.action === 'string';
}

function hashIP(ip?: string | null) {
  if (!ip) return null;
  try {
    // Simple, non-cryptographic hash for demo purposes; replace with SHA-256 on the server if needed
    let h = 0;
    for (let i = 0; i < ip.length; i++) h = (h << 5) - h + ip.charCodeAt(i);
    return `h${Math.abs(h)}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const event = await req.json();
    if (!isValidEvent(event)) return NextResponse.json({ ok: false }, { status: 400 });
    const ip = (req as any).ip || (req.headers as any).get?.('x-forwarded-for')?.split(',')[0];
    const record = { ...event, timestamp: new Date().toISOString(), ip_hash: hashIP(ip) };
    // TODO: Insert into database (Supabase/Prisma). For now, no-op.
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

