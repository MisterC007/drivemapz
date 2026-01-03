const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

export async function geocodeAddress(address: string) {
  const url =
    `${NOMINATIM_URL}/search?format=json&limit=1&q=` +
    encodeURIComponent(address);

  const res = await fetch(url, {
    headers: {
      // Nominatim wil een User-Agent; in dev werkt dit meestal zo al,
      // maar dit helpt tegen rare responses.
      "Accept": "application/json",
    },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}: ${text.slice(0, 200)}`);

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Geocode gaf geen JSON terug: ${text.slice(0, 200)}`);
  }

  if (!Array.isArray(json) || json.length === 0) {
    throw new Error("Adres niet gevonden (geocode).");
  }

  return {
    lat: Number(json[0].lat),
    lon: Number(json[0].lon),
    display: json[0].display_name as string,
  };
}

export async function routeKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const url =
    `${process.env.NEXT_PUBLIC_OSRM_BASE_URL ?? "https://router.project-osrm.org"}` +
    `/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}: ${text.slice(0, 200)}`);

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`OSRM gaf geen JSON terug: ${text.slice(0, 200)}`);
  }

  const meters = json?.routes?.[0]?.distance;
  if (typeof meters !== "number") throw new Error("OSRM route niet beschikbaar.");

  return meters / 1000;
}
