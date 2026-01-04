'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/app/lib/database.types'
import { supabase } from '@/app/lib/supabaseClient'

type TripRow = Database['public']['Tables']['trips']['Row']

export default function TripsHomePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [trips, setTrips] = useState<TripRow[]>([])
  const [name, setName] = useState('Roadtrip Italië 2026')

  async function load() {
    setLoading(true)
    setMsg('')

    const { data: sess, error: sErr } = await supabase.auth.getSession()
    if (sErr) {
      setMsg(sErr.message)
      setLoading(false)
      return
    }

    const uid = sess.session?.user?.id
    if (!uid) {
      // middleware zou je normaal al naar /login sturen, maar dit is extra safety
      router.replace('/login')
      return
    }

    setUserId(uid)
    setEmail(sess.session?.user?.email ?? '')

    const { data, error } = await supabase
      .from('trips')
      .select('id,user_id,name,start_date,end_date,created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (error) setMsg(error.message)
    setTrips(data ?? [])
    setLoading(false)
  }

  async function createTrip() {
    setMsg('')
    const tname = name.trim()
    if (!tname) {
      setMsg('Geef een naam voor de trip.')
      return
    }

    const { data: sess } = await supabase.auth.getSession()
    const uid = sess.session?.user?.id
    if (!uid) {
      router.replace('/login')
      return
    }

    const { data, error } = await supabase
      .from('trips')
      .insert({ user_id: uid, name: tname })
      .select('id')
      .single()

    if (error) {
      setMsg(error.message)
      return
    }

    router.push(`/trips/${data.id}`)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  useEffect(() => {
    load()
    const { data: sub } = supabase.auth.onAuthStateChange(() => load())
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">DriveMapz — Trips</h1>

        <div className="flex items-center gap-3">
          <div className="text-sm opacity-80">
            Ingelogd als: <b>{email}</b>
          </div>
          <button className="rounded-lg border px-4 py-2" onClick={() => router.push('/settings')}>
            Instellingen
          </button>
          <button className="rounded-lg border px-4 py-2" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="mt-8 rounded-2xl border p-5">
        <div className="text-lg font-semibold">Nieuwe trip</div>

        <div className="mt-3 flex gap-3">
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam van je trip"
          />
          <button className="rounded-lg bg-black px-5 py-2 text-white" onClick={createTrip}>
            Maak
          </button>
        </div>

        {msg && <div className="mt-3 rounded-lg border px-3 py-2 text-sm">{msg}</div>}
      </section>

      <section className="mt-8">
        <div className="text-lg font-semibold">Jouw trips</div>

        {loading ? (
          <div className="mt-3 opacity-70">Laden…</div>
        ) : trips.length === 0 ? (
          <div className="mt-3 opacity-70">Nog geen trips. Maak er eentje aan.</div>
        ) : (
          <div className="mt-3 grid gap-3">
            {trips.map((t) => (
              <button
                key={t.id}
                className="rounded-xl border p-4 text-left hover:bg-black/5"
                onClick={() => router.push(`/trips/${t.id}`)}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm opacity-70">Trip ID: {t.id}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
