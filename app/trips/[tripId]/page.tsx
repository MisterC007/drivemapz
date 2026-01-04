'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Database } from '@/app/lib/database.types'
import { supabase } from '@/app/lib/supabaseClient'
import { startTracking, stopTracking } from '@/app/lib/tracking'

const TripMap = dynamic(() => import('@/app/components/TripMap'), { ssr: false })

type StopRow = Database['public']['Tables']['trip_stops']['Row']
type FuelRow = Database['public']['Tables']['fuel_logs']['Row']
type TollRow = Database['public']['Tables']['toll_logs']['Row']
type TrackPoint = Database['public']['Tables']['trip_track_points']['Row']

const SPECIAL = [
  { value: 'start', label: 'Vertrekpunt (thuis)' },
  { value: 'end', label: 'Eindpunt (thuis)' },
  { value: 'stop', label: 'Normale stop' },
] as const

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

export default function TripPage() {
  const params = useParams<{ tripId: string }>()
  const tripId = params.tripId
  const router = useRouter()

  const [tab, setTab] = useState<'stops' | 'fuel' | 'toll' | 'map'>('stops')
  const [email, setEmail] = useState<string>('')
  const [msg, setMsg] = useState<string>('')

  const [stops, setStops] = useState<StopRow[]>([])
  const [fuel, setFuel] = useState<FuelRow[]>([])
  const [toll, setToll] = useState<TollRow[]>([])
  const [track, setTrack] = useState<TrackPoint[]>([])

  const [tracking, setTracking] = useState(false)

  // --- New stop form ---
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [kind, setKind] = useState<'stop' | 'start' | 'end'>('stop')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [arrivedAt, setArrivedAt] = useState('')
  const [departedAt, setDepartedAt] = useState('')

  // --- Fuel form ---
  const [fuelStopId, setFuelStopId] = useState<string>('')
  const [fuelDate, setFuelDate] = useState('')
  const [odoKm, setOdoKm] = useState('')
  const [liters, setLiters] = useState('')
  const [paid, setPaid] = useState('')
  const [fuelCountry, setFuelCountry] = useState('')

  // --- Toll form ---
  const [tollDate, setTollDate] = useState('')
  const [tollAmount, setTollAmount] = useState('')
  const [tollCountry, setTollCountry] = useState('')
  const [tollRoad, setTollRoad] = useState('')
  const [tollNotes, setTollNotes] = useState('')

  const stopsForMap = useMemo(
    () =>
      stops.map((s) => ({
        id: s.id,
        stop_index: s.stop_index,
        stop_type: s.kind,
        type: null,
        name: s.title ?? '',
        address_text: null,
        address: null,
        lat: s.lat,
        lon: s.lng, // TripMap verwacht lon
      })),
    [stops]
  )

  const plannedKm = useMemo(() => {
    const pts = stops
      .slice()
      .sort((a, b) => a.stop_index - b.stop_index)
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({ lat: s.lat!, lon: s.lng! }))
    let sum = 0
    for (let i = 1; i < pts.length; i++) sum += haversineKm(pts[i - 1], pts[i])
    return sum
  }, [stops])

  const actualKm = useMemo(() => {
    const pts = track
      .slice()
      .filter((p) => !!p.captured_at)
      .sort((a, b) => (a.captured_at ?? '').localeCompare(b.captured_at ?? ''))
      .map((p) => ({ lat: p.lat, lon: p.lng }))
    let sum = 0
    for (let i = 1; i < pts.length; i++) sum += haversineKm(pts[i - 1], pts[i])
    return sum
  }, [track])

  const fuelTotal = useMemo(() => fuel.reduce((a, r) => a + (r.total_paid ?? 0), 0), [fuel])
  const tollTotal = useMemo(() => toll.reduce((a, r) => a + (r.amount ?? 0), 0), [toll])
  const grandTotal = useMemo(() => fuelTotal + tollTotal, [fuelTotal, tollTotal])

  function resetStopForm() {
    setInsertAt(null)
    setKind('stop')
    setTitle('')
    setNotes('')
    setArrivedAt('')
    setDepartedAt('')
  }

  async function loadAll() {
    setMsg('')
    const { data: sess } = await supabase.auth.getSession()
    const user = sess.session?.user
    if (!user) {
      setMsg('Auth session missing! (Login opnieuw in /)')
      return
    }
    setEmail(user.email ?? '')

    const s1 = await supabase
      .from('trip_stops')
      .select('*')
      .eq('trip_id', tripId)
      .order('stop_index', { ascending: true })
    if (s1.error) throw s1.error
    setStops(s1.data ?? [])

    const f1 = await supabase
      .from('fuel_logs')
      .select('id,filled_at,stop_id,country_code,odometer_km,liters,total_paid,price_per_l,trip_id,user_id,created_at')
      .eq('trip_id', tripId)
      .order('filled_at', { ascending: false })
    if (f1.error) throw f1.error
    setFuel(f1.data ?? [])

    const t1 = await supabase
      .from('toll_logs')
      .select('*')
      .eq('trip_id', tripId)
      .order('paid_at', { ascending: false })
    if (t1.error) throw t1.error
    setToll(t1.data ?? [])

    const tr = await supabase
      .from('trip_track_points')
      .select('id,trip_id,user_id,lat,lng,accuracy_m,speed,heading,captured_at,created_at')
      .eq('trip_id', tripId)
      .order('captured_at', { ascending: true })
      .limit(5000)
    if (tr.error) throw tr.error
    setTrack(tr.data ?? [])
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await loadAll()
      } catch (e: any) {
        console.error(e)
        setMsg(e?.message ?? String(e))
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      if (!mounted) return
      try {
        await loadAll()
      } catch {}
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function addStop() {
    setMsg('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const userId = sess.session?.user?.id
      if (!userId) throw new Error('Auth session missing')

      const maxIndex = stops.length ? Math.max(...stops.map((s) => s.stop_index)) : 0
      const targetIndex = insertAt ?? maxIndex + 1

      const payload: any = {
        title:
          title?.trim() ||
          (kind === 'start' ? 'Vertrekpunt (thuis)' : kind === 'end' ? 'Eindpunt (thuis)' : 'Stop'),
        kind,
        notes: notes?.trim() || null,
        arrived_at: arrivedAt ? new Date(arrivedAt).toISOString() : null,
        departed_at: departedAt ? new Date(departedAt).toISOString() : null,
      }

      const { error } = await supabase.rpc('insert_stop_at', {
        p_trip_id: tripId,
        p_index: targetIndex,
        p_payload: payload,
      })

      if (error) throw error

      await loadAll()
      resetStopForm()
    } catch (e: any) {
      console.error('addStop error', e)
      setMsg(e?.message ?? String(e))
    }
  }

  async function moveStop(from: number, to: number) {
    setMsg('')
    try {
      const { error } = await supabase.rpc('move_stop', { p_trip_id: tripId, p_from: from, p_to: to })
      if (error) throw error
      await loadAll()
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    }
  }

  async function deleteStop(stopId: string) {
    if (!confirm('Stop verwijderen?')) return
    setMsg('')
    try {
      const { error } = await supabase.rpc('delete_stop_and_reindex', { p_stop_id: stopId })
      if (error) throw error
      await loadAll()
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    }
  }

  async function addFuel() {
    setMsg('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const userId = sess.session?.user?.id
      if (!userId) throw new Error('Auth session missing')

      const row = {
        user_id: userId,
        trip_id: tripId,
        stop_id: fuelStopId || null,
        filled_at: fuelDate ? new Date(fuelDate).toISOString() : new Date().toISOString(),
        country_code: fuelCountry || null,
        odometer_km: odoKm ? Number(odoKm) : null,
        liters: liters ? Number(liters) : null,
        total_paid: paid ? Number(paid) : null,
      }

      const { error } = await supabase.from('fuel_logs').insert(row)
      if (error) throw error

      setFuelStopId('')
      setFuelDate('')
      setOdoKm('')
      setLiters('')
      setPaid('')
      setFuelCountry('')
      await loadAll()
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    }
  }

  async function addToll() {
    setMsg('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const userId = sess.session?.user?.id
      if (!userId) throw new Error('Auth session missing')

      const row = {
        user_id: userId,
        trip_id: tripId,
        paid_at: tollDate ? new Date(tollDate).toISOString() : new Date().toISOString(),
        country_code: tollCountry || null,
        road_name: tollRoad || null,
        amount: Number(tollAmount || 0),
        notes: tollNotes || null,
      }

      const { error } = await supabase.from('toll_logs').insert(row)
      if (error) throw error

      setTollDate('')
      setTollAmount('')
      setTollCountry('')
      setTollRoad('')
      setTollNotes('')
      await loadAll()
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    }
  }

  async function toggleTracking() {
    setMsg('')
    try {
      if (!tracking) {
        await startTracking(tripId)
        setTracking(true)
      } else {
        await stopTracking()
        setTracking(false)
      }
    } catch (e: any) {
      setMsg(e?.message ?? String(e))
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <div className="text-3xl font-bold">Trip</div>
          <div className="text-sm opacity-70">Ingelogd als: {email || '...'}</div>
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-4 py-2" onClick={() => router.push('/')}>Trips</button>
          <button className="border rounded-xl px-4 py-2" onClick={() => router.push('/settings')}>Instellingen</button>
          <button className="border rounded-xl px-4 py-2" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`border rounded-xl px-4 py-2 ${tab === 'stops' ? 'font-bold' : ''}`} onClick={() => setTab('stops')}>Stops</button>
        <button className={`border rounded-xl px-4 py-2 ${tab === 'fuel' ? 'font-bold' : ''}`} onClick={() => setTab('fuel')}>Tankbeurten</button>
        <button className={`border rounded-xl px-4 py-2 ${tab === 'toll' ? 'font-bold' : ''}`} onClick={() => setTab('toll')}>Tol</button>
        <button className={`border rounded-xl px-4 py-2 ${tab === 'map' ? 'font-bold' : ''}`} onClick={() => setTab('map')}>Kaart</button>

        <button className="ml-auto border rounded-xl px-4 py-2" onClick={toggleTracking}>
          {tracking ? 'Stop tracking' : 'Start tracking'}
        </button>
      </div>

      {msg && <div className="border rounded-xl p-3 mb-4">{msg}</div>}

      <div className="border rounded-2xl p-4 mb-6">
        <div className="font-semibold mb-2">Totals</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Gepland (lijn) km:</div><div className="text-right">{plannedKm.toFixed(1)} km</div>
          <div>Effectief gereden km:</div><div className="text-right">{actualKm.toFixed(1)} km</div>
          <div>Tank (totaal):</div><div className="text-right">€ {fuelTotal.toFixed(2)}</div>
          <div>Tol (totaal):</div><div className="text-right">€ {tollTotal.toFixed(2)}</div>
          <div className="font-semibold">Totaal reis:</div><div className="text-right font-semibold">€ {grandTotal.toFixed(2)}</div>
        </div>
      </div>

      {tab === 'stops' && (
        <>
          <div className="border rounded-2xl p-5 mb-6">
            <div className="font-semibold text-lg mb-3">Nieuwe stop {insertAt ? `(invoegen op #${insertAt})` : ''}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Soort</label>
                <select className="w-full border rounded-xl p-3" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                  {SPECIAL.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm opacity-80">Titel</label>
                <input className="w-full border rounded-xl p-3" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm opacity-80">Notities / adres</label>
                <input className="w-full border rounded-xl p-3" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div>
                <label className="text-sm opacity-80">Aankomst (datetime)</label>
                <input type="datetime-local" className="w-full border rounded-xl p-3" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)} />
              </div>
              <div>
                <label className="text-sm opacity-80">Vertrek (datetime)</label>
                <input type="datetime-local" className="w-full border rounded-xl p-3" value={departedAt} onChange={(e) => setDepartedAt(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="bg-black text-white rounded-xl px-5 py-3" onClick={addStop}>Stop toevoegen</button>
              <button className="border rounded-xl px-5 py-3" onClick={resetStopForm}>Reset</button>
            </div>
          </div>

          <div className="font-semibold text-lg mb-3">Stops</div>

          <div className="space-y-3">
            {stops.map((s, idx) => (
              <div key={s.id} className="border rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      #{s.stop_index} — {s.title ?? '(geen titel)'}{' '}
                      <span className="text-xs border rounded-lg px-2 py-1 ml-2">{s.kind ?? 'stop'}</span>
                    </div>
                    <div className="text-sm opacity-80">{s.notes ?? ''}</div>
                    <div className="text-sm mt-1">
                      Aankomst: <b>{s.arrived_at ?? '-'}</b> — Vertrek: <b>{s.departed_at ?? '-'}</b>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button className="border rounded-xl px-3 py-2"
                      onClick={() => { setInsertAt(s.stop_index); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    >
                      + Tussen plaatsen hier
                    </button>

                    <div className="flex gap-2">
                      <button className="border rounded-xl px-3 py-2" disabled={idx === 0}
                        onClick={() => moveStop(s.stop_index, s.stop_index - 1)}
                      >
                        ↑
                      </button>
                      <button className="border rounded-xl px-3 py-2" disabled={idx === stops.length - 1}
                        onClick={() => moveStop(s.stop_index, s.stop_index + 1)}
                      >
                        ↓
                      </button>
                    </div>

                    <button className="border rounded-xl px-3 py-2" onClick={() => deleteStop(s.id)}>
                      Verwijderen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'fuel' && (
        <div className="space-y-4">
          <div className="border rounded-2xl p-5">
            <div className="font-semibold text-lg mb-3">Tankbeurt toevoegen</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Koppel aan stop (optioneel)</label>
                <select className="w-full border rounded-xl p-3" value={fuelStopId} onChange={(e) => setFuelStopId(e.target.value)}>
                  <option value="">(geen)</option>
                  {stops.map((s) => (
                    <option key={s.id} value={s.id}>#{s.stop_index} — {s.title ?? ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm opacity-80">Datum/tijd</label>
                <input type="datetime-local" className="w-full border rounded-xl p-3" value={fuelDate} onChange={(e) => setFuelDate(e.target.value)} />
              </div>

              <div>
                <label className="text-sm opacity-80">Km-stand</label>
                <input className="w-full border rounded-xl p-3" value={odoKm} onChange={(e) => setOdoKm(e.target.value)} />
              </div>

              <div>
                <label className="text-sm opacity-80">Liters</label>
                <input className="w-full border rounded-xl p-3" value={liters} onChange={(e) => setLiters(e.target.value)} />
              </div>

              <div>
                <label className="text-sm opacity-80">Betaald (€)</label>
                <input className="w-full border rounded-xl p-3" value={paid} onChange={(e) => setPaid(e.target.value)} />
              </div>

              <div>
                <label className="text-sm opacity-80">Landcode (bv. BE, FR, LU)</label>
                <input className="w-full border rounded-xl p-3" value={fuelCountry} onChange={(e) => setFuelCountry(e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="bg-black text-white rounded-xl px-5 py-3" onClick={addFuel}>Tankbeurt opslaan</button>
            </div>
          </div>

          <div className="border rounded-2xl p-5">
            <div className="font-semibold text-lg mb-3">Tankbeurten</div>
            {fuel.length === 0 ? (
              <div className="opacity-70">Nog geen tankbeurten.</div>
            ) : (
              <div className="space-y-2">
                {fuel.map((f) => (
                  <div key={f.id} className="border rounded-xl p-3 text-sm">
                    <div className="flex justify-between">
                      <div>
                        <b>{new Date(f.filled_at).toLocaleString()}</b>
                        {f.country_code ? <span className="ml-2 text-xs border rounded-lg px-2 py-1">{f.country_code}</span> : null}
                      </div>
                      <div>€ {(f.total_paid ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="opacity-80">
                      Km: {f.odometer_km ?? '-'} — Liters: {f.liters ?? '-'} — €/L: {(f.price_per_l ?? 0).toFixed(3)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'toll' && (
        <div className="space-y-4">
          <div className="border rounded-2xl p-5">
            <div className="font-semibold text-lg mb-3">Tol toevoegen</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Datum/tijd</label>
                <input type="datetime-local" className="w-full border rounded-xl p-3" value={tollDate} onChange={(e) => setTollDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm opacity-80">Bedrag (€)</label>
                <input className="w-full border rounded-xl p-3" value={tollAmount} onChange={(e) => setTollAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-sm opacity-80">Landcode</label>
                <input className="w-full border rounded-xl p-3" value={tollCountry} onChange={(e) => setTollCountry(e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className="text-sm opacity-80">Weg/Traject</label>
                <input className="w-full border rounded-xl p-3" value={tollRoad} onChange={(e) => setTollRoad(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm opacity-80">Notities</label>
                <input className="w-full border rounded-xl p-3" value={tollNotes} onChange={(e) => setTollNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="bg-black text-white rounded-xl px-5 py-3" onClick={addToll}>Tol opslaan</button>
            </div>
          </div>

          <div className="border rounded-2xl p-5">
            <div className="font-semibold text-lg mb-3">Tol</div>
            {toll.length === 0 ? (
              <div className="opacity-70">Nog geen tol.</div>
            ) : (
              <div className="space-y-2">
                {toll.map((t) => (
                  <div key={t.id} className="border rounded-xl p-3 text-sm">
                    <div className="flex justify-between">
                      <div>
                        <b>{new Date(t.paid_at).toLocaleString()}</b>
                        {t.country_code ? <span className="ml-2 text-xs border rounded-lg px-2 py-1">{t.country_code}</span> : null}
                      </div>
                      <div>€ {(t.amount ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="opacity-80">
                      {t.road_name ?? ''} {t.notes ? `— ${t.notes}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'map' && (
        <div className="space-y-4">
          <TripMap stops={stopsForMap as any} track={track.map(p => ({
            id: p.id,
            recorded_at: p.captured_at ?? '',
            lat: p.lat,
            lon: p.lng
          })) as any} />
        </div>
      )}
    </div>
  )
}
