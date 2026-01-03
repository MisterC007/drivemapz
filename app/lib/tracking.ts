'use client'

import { supabase } from '@/app/lib/supabaseClient'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

type TrackInsert = {
  user_id: string
  trip_id: string
  lat: number
  lon: number
  accuracy_m?: number | null
  speed_mps?: number | null
  heading_deg?: number | null
}

let webWatchId: number | null = null
let nativeStarted = false
let lastSentAt = 0

async function insertPoint(p: TrackInsert) {
  const { error } = await supabase.from('trip_track_points').insert({
    user_id: p.user_id,
    trip_id: p.trip_id,
    lat: p.lat,
    lon: p.lon,
    accuracy_m: p.accuracy_m ?? null,
    speed_mps: p.speed_mps ?? null,
    heading_deg: p.heading_deg ?? null,
  })
  if (error) throw error
}

async function tryGetBgGeo() {
  // Alleen op native proberen (anders nooit importen)
  if (!Capacitor.isNativePlatform()) return null

  try {
    // Let op: dynamic import in try/catch => build crasht niet als module ontbreekt
    const mod: any = await import('@capacitor-community/background-geolocation')
    return mod?.BackgroundGeolocation ?? null
  } catch {
    return null
  }
}

export async function startTracking(tripId: string) {
  const { data: sess } = await supabase.auth.getSession()
  const userId = sess.session?.user?.id
  if (!userId) throw new Error('Auth session missing')

  const isNative = Capacitor.isNativePlatform()

  if (isNative) {
    if (nativeStarted) return
    nativeStarted = true

    await Geolocation.requestPermissions()

    const BackgroundGeolocation = await tryGetBgGeo()
    if (!BackgroundGeolocation) {
      // Native, maar plugin ontbreekt => val terug naar foreground tracking of geef duidelijke fout
      // Ik kies hier: duidelijke fout (dan weet je dat je cap setup nog moet doen)
      nativeStarted = false
      throw new Error(
        'Background tracking plugin ontbreekt. Installeer @capacitor-community/background-geolocation en voeg Android/iOS platform toe (Capacitor).'
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

        const now = Date.now()
        if (now - lastSentAt < 20000) return
        lastSentAt = now

        await insertPoint({
          user_id: userId,
          trip_id: tripId,
          lat: location.latitude,
          lon: location.longitude,
          accuracy_m: location.accuracy,
          speed_mps: location.speed,
          heading_deg: location.bearing,
        })
      }
    )

    return
  }

  // WEB fallback
  if (webWatchId != null) return

  try {
    const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    if (perm.state === 'denied') throw new Error('Geolocation denied in browser')
  } catch {
    // Safari etc.
  }

  webWatchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const now = Date.now()
      if (now - lastSentAt < 20000) return
      lastSentAt = now

      await insertPoint({
        user_id: userId,
        trip_id: tripId,
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
        speed_mps: pos.coords.speed ?? null,
        heading_deg: pos.coords.heading ?? null,
      })
    },
    (err) => console.error('watchPosition error', err),
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  )
}

export async function stopTracking() {
  if (Capacitor.isNativePlatform()) {
    nativeStarted = false
    const BackgroundGeolocation = await tryGetBgGeo()
    if (BackgroundGeolocation) {
      await BackgroundGeolocation.removeAllWatchers()
    }
    return
  }

  if (webWatchId != null) {
    navigator.geolocation.clearWatch(webWatchId)
    webWatchId = null
  }
}
