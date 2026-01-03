import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  const radius = Number(searchParams.get('radius') ?? '5000'); // meters

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'missing/invalid lat lon' }, { status: 400 });
  }

  // Overpass query: amenity=fuel in radius
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="fuel"](around:${radius},${lat},${lon});
      way["amenity"="fuel"](around:${radius},${lat},${lon});
      relation["amenity"="fuel"](around:${radius},${lat},${lon});
    );
    out center tags;
  `.trim();

  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: query,
    cache: 'no-store',
  });

  if (!r.ok) {
    return NextResponse.json({ error: `overpass failed: ${r.status}` }, { status: 500 });
  }

  const json = await r.json();

  const items = (json.elements ?? []).map((e: any) => {
    const elLat = e.type === 'node' ? e.lat : e.center?.lat;
    const elLon = e.type === 'node' ? e.lon : e.center?.lon;
    const name = e.tags?.name ?? e.tags?.brand ?? 'Tankstation';
    const addr =
      e.tags?.['addr:street']
        ? `${e.tags?.['addr:street']} ${e.tags?.['addr:housenumber'] ?? ''}`.trim()
        : (e.tags?.['addr:full'] ?? null);

    return {
      id: `${e.type}/${e.id}`,
      name,
      lat: elLat ?? null,
      lon: elLon ?? null,
      address: addr,
      brand: e.tags?.brand ?? null,
      operator: e.tags?.operator ?? null,
    };
  });

  return NextResponse.json({ items });
}
