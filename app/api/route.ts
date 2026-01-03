import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });

  // Nominatim policy: stuur User-Agent
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', q);

  const r = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'DriveMapz/1.0 (local dev)',
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!r.ok) {
    return NextResponse.json({ error: `geocode failed: ${r.status}` }, { status: 500 });
  }

  const data: any[] = await r.json();
  const first = data?.[0];
  if (!first) return NextResponse.json({ lat: null, lon: null });

  return NextResponse.json({
    lat: Number(first.lat),
    lon: Number(first.lon),
    display_name: first.display_name ?? null,
  });
}
