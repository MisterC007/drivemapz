'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

export type StopRow = {
  id: string
  stop_index: number
  stop_type: string | null // 'start' | 'end' | 'stop'
  type: string | null      // enum: camperplaats/camping/parking
  name: string
  address_text: string | null
  address: string | null
  lat: number | null
  lon: number | null
}

export type TrackPoint = {
  id: string
  recorded_at: string
  lat: number
  lon: number
}

export default function TripMap({
  stops,
  track,
}: {
  stops: StopRow[]
  track: TrackPoint[]
}) {
  const ptsStops = stops
    .filter(s => typeof s.lat === 'number' && typeof s.lon === 'number')
    .sort((a, b) => a.stop_index - b.stop_index)
    .map(s => [s.lat!, s.lon!] as [number, number])

  const ptsTrack = (track ?? [])
    .slice()
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    .map(p => [p.lat, p.lon] as [number, number])

  const center: [number, number] = ptsStops[0] ?? ptsTrack[0] ?? [50.85, 4.35]

  return (
    <div className="rounded-2xl border p-3">
      <div className="font-semibold mb-2">Kaart</div>
      <div className="h-[380px] overflow-hidden rounded-xl border">
        <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {ptsStops.length >= 2 && <Polyline positions={ptsStops} />}
          {ptsTrack.length >= 2 && <Polyline positions={ptsTrack} />}

          {stops
            .filter(s => typeof s.lat === 'number' && typeof s.lon === 'number')
            .map(s => (
              <Marker key={s.id} position={[s.lat!, s.lon!]} icon={icon}>
                <Popup>
                  <div className="font-semibold">#{s.stop_index} — {s.name}</div>
                  <div className="text-sm opacity-80">{s.address_text ?? s.address ?? ''}</div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      <div className="text-xs opacity-70 mt-2">
        Polyline = planning (stops) + effectief gereden (tracking). Tracking verschijnt als je punten hebt.
      </div>
    </div>
  )
}
