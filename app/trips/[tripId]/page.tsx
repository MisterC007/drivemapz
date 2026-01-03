'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/app/lib/supabaseClient'
import { startTracking, stopTracking } from '@/app/lib/tracking'

const TripMap = dynamic(() => import('@/app/components/TripMap'), { ssr: false })

type StopRow = {
  id: string
  stop_index: number
  stop_type: string | null // start/end/stop
  type: string | null      // enum: camperplaats/camping/parking
  name: string
  address_text: string | null
  address: string | null
  country_code: string | null
  lat: number | null
  lon: number | null
  arrival_date: string | null
  departure_date: string | null
  nights: number | null
  price_per_night: number | null
  total_price: number | null
  payment_status: string | null
  paid_amount: number | null
  notes: string | null
  is_fuel_anchor: boolean | null
}

type FuelRow = {
  id: string
  filled_at: string
  stop_id: string | null
  country_code: string | null
  odometer_km: number | null
  liters: number | null
  total_paid: number | null
  price_per_l: number | null
}

type TollRow = {
  id: string
  paid_at: string
  country_code: string | null
  road_name: string | null
  amount: number
  notes: string | null
}

type TrackPoint = {
  id: string
  recorded_at: string
  lat: number
  lon: number
}

const STOP_ENUMS = [
  { value: 'camperplaats', label: 'Camperplaats' },
  { value: 'camping', label: 'Camping' },
  { value: 'parking', label: 'Parking' },
] as const

const SPECIAL = [
  { value: 'start', label: 'Vertrekpunt (thuis)' },
  { value: 'end', label: 'Eindpunt (thuis)' },
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

  // --- New stop form (single form that can also "insert between") ---
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [specialKind, setSpecialKind] = useState<string>('stop') // stop | start | end
  const [stopType, setStopType] = useState<string>('camperplaats') // enum only
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [arrival, setArrival] = useState('')
  const [departure, setDeparture] = useState('')
  const [pricePerNight, setPricePerNight] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [payment, setPayment] = useState<'unpaid' | 'partial' | 'paid'>('unpaid')
  const [paidAmount, setPaidAmount] = useState('')
  const [isFuelAnchor, setIsFuelAnchor] = useState(false)

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

  const stopsForMap = useMemo(() => stops.map(s => ({
    id: s.id,
    stop_index: s.stop_index,
    stop_type: s.stop_type,
    type: s.type,
    name: s.name,
    address_text: s.address_text,
    address: s.address,
    lat: s.lat,
    lon: s.lon,
  })), [stops])

  const plannedKm = useMemo(() => {
    const pts = stops
      .slice()
      .sort((a, b) => a.stop_index - b.stop_index)
      .filter(s => typeof s.lat === 'number' && typeof s.lon === 'number')
      .map(s => ({ lat: s.lat!, lon: s.lon! }))
    let sum = 0
    for (let i = 1; i < pts.length; i++) sum += haversineKm(pts[i - 1], pts[i])
    return sum
  }, [stops])

  const actualKm = useMemo(() => {
    const pts = track
      .slice()
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map(p => ({ lat: p.lat, lon: p.lon }))
    let sum = 0
    for (let i = 1; i < pts.length; i++) sum += haversineKm(pts[i - 1], pts[i])
    return sum
  }, [track])

  const fuelTotal = useMemo(() => fuel.reduce((a, r) => a + (r.total_paid ?? 0), 0), [fuel])
  const tollTotal = useMemo(() => toll.reduce((a, r) => a + (r.amount ?? 0), 0), [toll])
  const stayTotal = useMemo(() => stops.reduce((a, s) => a + (s.total_price ?? 0), 0), [stops])
  const grandTotal = useMemo(() => fuelTotal + tollTotal + stayTotal, [fuelTotal, tollTotal, stayTotal])

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
    setStops((s1.data ?? []) as StopRow[])

    const f1 = await supabase
      .from('fuel_logs')
      .select('id,filled_at,stop_id,country_code,odometer_km,liters,total_paid,price_per_l')
      .eq('trip_id', tripId)
      .order('filled_at', { ascending: false })

    if (f1.error) throw f1.error
    setFuel((f1.data ?? []) as FuelRow[])

    const t1 = await supabase
      .from('toll_logs')
      .select('*')
      .eq('trip_id', tripId)
      .order('paid_at', { ascending: false })

    if (t1.error) throw t1.error
    setToll((t1.data ?? []) as TollRow[])

    const tr = await supabase
      .from('trip_track_points')
      .select('id,recorded_at,lat,lon')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: true })
      .limit(5000)

    if (tr.error) throw tr.error
    setTrack((tr.data ?? []) as TrackPoint[])
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
      try { await loadAll() } catch {}
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

  function resetStopForm() {
    setInsertAt(null)
    setSpecialKind('stop')
    setStopType('camperplaats')
    setLabel('')
    setAddress('')
    setArrival('')
    setDeparture('')
    setPricePerNight('')
    setTotalPrice('')
    setPayment('unpaid')
    setPaidAmount('')
    setIsFuelAnchor(false)
  }

  async function addStop() {
    setMsg('')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const userId = sess.session?.user?.id
      if (!userId) throw new Error('Auth session missing')

      const maxIndex = stops.length ? Math.max(...stops.map(s => s.stop_index)) : 0
      const targetIndex = insertAt ?? (maxIndex + 1)

      const payload: any = {
        name: label?.trim() || (specialKind === 'start' ? 'Vertrekpunt (thuis)' : specialKind === 'end' ? 'Eindpunt (thuis)' : 'Stop'),
        address_text: address?.trim() || null,
        address: address?.trim() || null,
        is_fuel_anchor: isFuelAnchor,
        payment_status: payment,
        paid_amount: paidAmount ? Number(paidAmount) : 0,
        price_per_night: pricePerNight ? Number(pricePerNight) : null,
        total_price: totalPrice ? Number(totalPrice) : null,
        arrival_date: arrival || null,
        departure_date: departure || null,
      }

      // type (enum) alleen bij normale stops
      if (specialKind === 'stop') {
        payload.type = stopType
        payload.stop_type = 'stop'
      } else {
        // start/end: NIET de enum “type” invullen met “thuis” (dat gaf je enum-error)
        payload.type = null
        payload.stop_type = specialKind // 'start' | 'end'
        if (specialKind === 'start') {
          payload.arrival_date = null
          payload.departure_date = departure || arrival || null // enkel “vertrekdatum”
        }
        if (specialKind === 'end') {
          payload.arrival_date = arrival || null
          payload.departure_date = null
        }
      }

      const { data, error } = await supabase.rpc('insert_stop_at', {
        p_trip_id: tripId,
        p_index: targetIndex,
        p_payload: payload,
      })

      if (error) throw error
      await loadAll()
      resetStopForm()
    } catch (e: any) {
      console.error('addStop error', e)
      setMsg(e?.message ?? JSON.stringify(e) ?? String(e))
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

  async function updateStop(stop: StopRow, patch: Partial<StopRow>) {
    setMsg('')
    try {
      const { error } = await supabase
        .from('trip_stops')
        .update(patch)
        .eq('id', stop.id)
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
          <div className="text-3xl font-bold">Stops</div>
          <div className="text-sm opacity-70">Ingelogd als: {email || '...'}</div>
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-4 py-2" onClick={() => router.push('/')}>Trips</button>
          <button className="border rounded-xl px-4 py-2" onClick={() => router.push('/settings')}>Instellingen</button>
          <button className="border rounded-xl px-4 py-2" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`border rounded-xl px-4 py-2 ${tab==='stops'?'font-bold':''}`} onClick={() => setTab('stops')}>Stops</button>
        <button className={`border rounded-xl px-4 py-2 ${tab==='fuel'?'font-bold':''}`} onClick={() => setTab('fuel')}>Tankbeurten</button>
        <button className={`border rounded-xl px-4 py-2 ${tab==='toll'?'font-bold':''}`} onClick={() => setTab('toll')}>Tol</button>
        <button className={`border rounded-xl px-4 py-2 ${tab==='map'?'font-bold':''}`} onClick={() => setTab('map')}>Kaart</button>

        <button className="ml-auto border rounded-xl px-4 py-2" onClick={toggleTracking}>
          {tracking ? 'Stop tracking' : 'Start tracking'}
        </button>
      </div>

      {msg && <div className="border rounded-xl p-3 mb-4">{msg}</div>}

      {/* Totals */}
      <div className="border rounded-2xl p-4 mb-6">
        <div className="font-semibold mb-2">Totals</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Gepland (lijn) km:</div><div className="text-right">{plannedKm.toFixed(1)} km</div>
          <div>Effectief gereden km:</div><div className="text-right">{actualKm.toFixed(1)} km</div>
          <div>Verblijf (totaal):</div><div className="text-right">€ {stayTotal.toFixed(2)}</div>
          <div>Tank (totaal):</div><div className="text-right">€ {fuelTotal.toFixed(2)}</div>
          <div>Tol (totaal):</div><div className="text-right">€ {tollTotal.toFixed(2)}</div>
          <div className="font-semibold">Totaal reis:</div><div className="text-right font-semibold">€ {grandTotal.toFixed(2)}</div>
        </div>
        <div className="text-xs opacity-70 mt-2">
          Gepland km = haversine tussen stops met lat/lon. Later kunnen we OSRM route-km toevoegen.
        </div>
      </div>

      {tab === 'stops' && (
        <>
          {/* New stop */}
          <div className="border rounded-2xl p-5 mb-6">
            <div className="font-semibold text-lg mb-3">Nieuwe stop {insertAt ? `(invoegen op #${insertAt})` : ''}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm opacity-80">Stop soort</label>
                <select className="w-full border rounded-xl p-3"
                  value={specialKind}
                  onChange={(e) => setSpecialKind(e.target.value)}
                >
                  <option value="stop">Normale stop</option>
                  {SPECIAL.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {specialKind === 'stop' ? (
                <div>
                  <label className="text-sm opacity-80">Type</label>
                  <select className="w-full border rounded-xl p-3"
                    value={stopType}
                    onChange={(e) => setStopType(e.target.value)}
                  >
                    {STOP_ENUMS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                </div>
              ) : (
                <div className="text-sm opacity-70 flex items-end">
                  Start/End gebruiken <b className="mx-1">stop_type (text)</b> = start/end. Geen enum “thuis”.
                </div>
              )}

              <div className="md:col-span-2">
                <label className="text-sm opacity-80">Label (optioneel)</label>
                <input className="w-full border rounded-xl p-3" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm opacity-80">Adres</label>
                <input className="w-full border rounded-xl p-3" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>

              {specialKind === 'start' ? (
                <div className="md:col-span-2">
                  <label className="text-sm opacity-80">Vertrekdatum</label>
                  <input type="date" className="w-full border rounded-xl p-3"
                    value={departure} onChange={(e) => setDeparture(e.target.value)}
                  />
                </div>
              ) : specialKind === 'end' ? (
                <div className="md:col-span-2">
                  <label className="text-sm opacity-80">Aankomstdatum</label>
                  <input type="date" className="w-full border rounded-xl p-3"
                    value={arrival} onChange={(e) => setArrival(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm opacity-80">Aankomst</label>
                    <input type="date" className="w-full border rounded-xl p-3"
                      value={arrival} onChange={(e) => setArrival(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm opacity-80">Vertrek</label>
                    <input type="date" className="w-full border rounded-xl p-3"
                      value={departure} onChange={(e) => setDeparture(e.target.value)}
                    />
                  </div>
                </>
              )}

              {specialKind === 'stop' && (
                <>
                  <div>
                    <label className="text-sm opacity-80">Prijs / nacht (€)</label>
                    <input className="w-full border rounded-xl p-3" value={pricePerNight} onChange={(e) => setPricePerNight(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm opacity-80">Totaal (€)</label>
                    <input className="w-full border rounded-xl p-3" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} />
                  </div>

                  <div>
                    <label className="text-sm opacity-80">Betaling</label>
                    <select className="w-full border rounded-xl p-3" value={payment} onChange={(e) => setPayment(e.target.value as any)}>
                      <option value="unpaid">Te betalen ter plaatse</option>
                      <option value="partial">Deel betaald</option>
                      <option value="paid">Volledig betaald</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm opacity-80">Reeds betaald (€)</label>
                    <input className="w-full border rounded-xl p-3" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <input type="checkbox" checked={isFuelAnchor} onChange={(e) => setIsFuelAnchor(e.target.checked)} />
                    <span className="text-sm">Tank-stop (anker)</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button className="bg-black text-white rounded-xl px-5 py-3" onClick={addStop}>Stop toevoegen</button>
              <button className="border rounded-xl px-5 py-3" onClick={resetStopForm}>Reset</button>
            </div>
          </div>

          {/* Stops list */}
          <div className="font-semibold text-lg mb-3">Stops</div>

          <div className="space-y-3">
            {stops.map((s, idx) => {
              const tag =
                s.stop_type === 'start' ? 'START' :
                s.stop_type === 'end' ? 'END' :
                (s.type ?? 'stop')

              const rest = Math.max((s.total_price ?? 0) - (s.paid_amount ?? 0), 0)

              return (
                <div key={s.id} className="border rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        #{s.stop_index} — {s.name}{' '}
                        <span className="text-xs border rounded-lg px-2 py-1 ml-2">{tag}</span>
                        {s.is_fuel_anchor ? <span className="text-xs border rounded-lg px-2 py-1 ml-2">TANK</span> : null}
                      </div>
                      <div className="text-sm opacity-80">{s.address_text ?? s.address ?? ''}</div>

                      <div className="text-sm mt-1">
                        {s.stop_type === 'start' && (
                          <>Vertrek: <b>{s.departure_date ?? '-'}</b></>
                        )}
                        {s.stop_type === 'end' && (
                          <>Aankomst: <b>{s.arrival_date ?? '-'}</b></>
                        )}
                        {s.stop_type === 'stop' && (
                          <>Aankomst: <b>{s.arrival_date ?? '-'}</b> — Vertrek: <b>{s.departure_date ?? '-'}</b> — Nachten: <b>{s.nights ?? '-'}</b></>
                        )}
                      </div>

                      {s.stop_type === 'stop' && (
                        <div className="text-xs opacity-70 mt-1">
                          Verblijf: € {(s.total_price ?? 0).toFixed(2)} — betaald: € {(s.paid_amount ?? 0).toFixed(2)} — rest: € {rest.toFixed(2)} ({s.payment_status ?? 'unpaid'})
                        </div>
                      )}
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

                  {/* Mini edit controls */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input className="border rounded-xl p-2" defaultValue={s.name}
                      onBlur={(e) => updateStop(s, { name: e.target.value })}
                      placeholder="Naam"
                    />
                    <input className="border rounded-xl p-2" defaultValue={s.address_text ?? ''}
                      onBlur={(e) => updateStop(s, { address_text: e.target.value })}
                      placeholder="Adres"
                    />
                    {s.stop_type === 'stop' ? (
                      <select className="border rounded-xl p-2" defaultValue={s.type ?? 'camperplaats'}
                        onChange={(e) => updateStop(s, { type: e.target.value })}
                      >
                        {STOP_ENUMS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    ) : (
                      <div className="text-sm opacity-70 flex items-center">Start/End: type (enum) blijft leeg</div>
                    )}
                  </div>
                </div>
              )
            })}
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
                  {stops.map(s => <option key={s.id} value={s.id}>#{s.stop_index} — {s.name}</option>)}
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

            <div className="text-xs opacity-70 mt-2">
              Prijs/L wordt automatisch berekend (total_paid / liters). Landprijzen tonen we straks bij “tankstations”.
            </div>
          </div>

          <div className="border rounded-2xl p-5">
            <div className="font-semibold text-lg mb-3">Tankbeurten</div>
            {fuel.length === 0 ? (
              <div className="opacity-70">Nog geen tankbeurten.</div>
            ) : (
              <div className="space-y-2">
                {fuel.map(f => (
                  <div key={f.id} className="border rounded-xl p-3 text-sm">
                    <div className="flex justify-between">
                      <div>
                        <b>{new Date(f.filled_at).toLocaleString()}</b>
                        {f.country_code ? <span className="ml-2 text-xs border rounded-lg px-2 py-1">{f.country_code}</span> : null}
                      </div>
                      <div>€ {(f.total_paid ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="opacity-80">
                      Km: {f.odometer_km ?? '-'} — Liters: {f.liters ?? '-'} — €/L: {f.price_per_l?.toFixed(3) ?? '-'}
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
                {toll.map(t => (
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
          <TripMap stops={stopsForMap as any} track={track} />
          <div className="border rounded-2xl p-4 text-sm opacity-80">
            Volgende stap: “tankstations tonen met prijzen” (OSM Overpass + landprijs uit country_fuel_prices) + route-km via OSRM.
          </div>
        </div>
      )}
    </div>
  )
}
