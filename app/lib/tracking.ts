'use client'

import { supabase } from '@/app/lib/supabaseClient'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

type TrackInsert = {
  user_id: string
  trip_id: string
  lat: number
  lng: number
  accuracy_m?: number | null
  speed?: number | null
  heading?: number | null
}

let webWatchId: number | null = null
let nativeStarted = false
let lastSentAt = 0

const MIN_SEND_INTERVAL_MS = 20_000

function shouldSendNow() {
  const now = Date.now()
  if (now - lastSentAt < MIN_SEND_INTERVAL_MS) return false
  lastSentAt = now
  return true
}

async function insertPoint(p: TrackInsert) {
  const { error } = await supabase.from('trip_track_points').insert({
    user_id: p.user_id,
    trip_id: p.trip_id,
    lat: p.lat,
    lng: p.lng,
    accuracy_m: p.accuracy_m ?? null,
    speed: p.speed ?? null,
    heading: p.heading ?? null,
    captured_at: new Date().toISOString(),
  })
  if (error) throw error
}

// ✅ geen import('@capacitor-community/background-geolocation')
async function tryGetBgGeo() {
  if (!Capacitor.isNativePlatform()) return null
  const anyCap: any = Capacitor as any
  return (
    anyCap?.Plugins?.BackgroundGeolocation ??
    anyCap?.Plugins?.BackgroundGeolocationPlugin ??
    null
  )
}

export async function startTracking(tripId: string) {
  const { data: sess, error: sessErr } = await supabase.auth.getSession()
  if (sessErr) throw sessErr

  const userId = sess.session?.user?.id
  if (!userId) throw new Error('Auth session missing')

  const isNative = Capacitor.isNativePlatform()

  if (isNative) {
    if (nativeStarted) return
    nativeStarted = true

    await Geolocation.requestPermissions()

    const BackgroundGeolocation = await tryGetBgGeo()
    if (!BackgroundGeolocation) {
      nativeStarted = false
      throw new Error(
        'Background tracking plugin niet gevonden in Capacitor.Plugins. Installeer plugin + npx cap sync.'
      )
    }

    await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'DriveMapz tracking',
        backgroundMessage: 'Live tracking actief',
        requestPermissions: true,
        stale: false,
        distanceFilter: 25,
      },
      async (location: any, error: any) => {
        if (error || !location) return
        if (!shouldSendNow()) return

        try {
          await insertPoint({
            user_id: userId,
            trip_id: tripId,
            lat: location.latitude,
            lng: location.longitude,
            accuracy_m: location.accuracy ?? null,
            speed: location.speed ?? null,
            heading: location.bearing ?? null,
          })
        } catch (e) {
          console.error('insertPoint(native) failed', e)
        }
      }
    )
    return
  }

  // WEB fallback
  if (webWatchId != null) return

  try {
    const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    if (perm.state === 'denied') throw new Error('Geolocation denied in browser')
  } catch {}

  webWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      if (!shouldSendNow()) return
      try {
        await insertPoint({
          user_id: userId,
          trip_id: tripId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy ?? null,
          speed: pos.coords.speed ?? null,
          heading: pos.coords.heading ?? null,
        })
      } catch (e) {
        console.error('insertPoint(web) failed', e)
      }
    },
    (err) => console.error('watchPosition error', err),
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
  )
}

export async function stopTracking() {
  if (Capacitor.isNativePlatform()) {
    nativeStarted = false
    const BackgroundGeolocation = await tryGetBgGeo()
    if (BackgroundGeolocation) {
      try {
        await BackgroundGeolocation.removeAllWatchers()
      } catch (e) {
        console.error('removeAllWatchers failed', e)
      }
    }
    return
  }

  if (webWatchId != null) {
    navigator.geolocation.clearWatch(webWatchId)
    webWatchId = null
  }
}
