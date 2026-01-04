"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Database } from "@/app/lib/database.types";
import { startTracking, stopTracking } from "@/app/lib/tracking";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

const supabase = supabaseBrowser();

const TripMap = dynamic(() => import("@/app/components/TripMap"), { ssr: false });

type StopRow = Database["public"]["Tables"]["trip_stops"]["Row"];
type FuelRow = Database["public"]["Tables"]["fuel_logs"]["Row"];
type TollRow = Database["public"]["Tables"]["toll_logs"]["Row"];
type TrackPoint = Database["public"]["Tables"]["trip_track_points"]["Row"];

const SPECIAL = [
  { value: "start", label: "Vertrekpunt (thuis)" },
  { value: "end", label: "Eindpunt (thuis)" },
  { value: "stop", label: "Normale stop" },
] as const;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export default function TripPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;
  const router = useRouter();

  const [tab, setTab] = useState<"stops" | "fuel" | "toll" | "map">("stops");
  const [email, setEmail] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const [stops, setStops] = useState<StopRow[]>([]);
  const [fuel, setFuel] = useState<FuelRow[]>([]);
  const [toll, setToll] = useState<TollRow[]>([]);
  const [track, setTrack] = useState<TrackPoint[]>([]);

  const [tracking, setTracking] = useState(false);

  // --- New stop form ---
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [kind, setKind] = useState<"stop" | "start" | "end">("stop");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [arrivedAt, setArrivedAt] = useState("");
  const [departedAt, setDepartedAt] = useState("");

  // --- Fuel form ---
  const [fuelStopId, setFuelStopId] = useState<string>("");
  const [fuelDate, setFuelDate] = useState("");
  const [odoKm, setOdoKm] = useState("");
  const [liters, setLiters] = useState("");
  const [paid, setPaid] = useState("");
  const [fuelCountry, setFuelCountry] = useState("");

  // --- Toll form ---
  const [tollDate, setTollDate] = useState("");
  const [tollAmount, setTollAmount] = useState("");
  const [tollCountry, setTollCountry] = useState("");
  const [tollRoad, setTollRoad] = useState("");
  const [tollNotes, setTollNotes] = useState("");

  const stopsForMap = useMemo(
    () =>
      stops.map((s) => ({
        id: s.id,
        stop_index: s.stop_index,
        stop_type: s.kind,
        type: null,
        name: s.title ?? "",
        address_text: null,
        address: null,
        lat: s.lat,
        lon: s.lng, // TripMap verwacht lon
      })),
    [stops]
  );

  const plannedKm = useMemo(() => {
    const pts = stops
      .slice()
      .sort((a, b) => a.stop_index - b.stop_index)
      .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
      .map((s) => ({ lat: s.lat!, lon: s.lng! }));
    let sum = 0;
    for (let i = 1; i < pts.length; i++) sum += haversineKm(pts[i - 1], pts[i]);
    return sum;
  }, [stops]);

  const actualKm = useMemo(() => {
    const pts = track
      .slice()
      .filter((p) => !!p.captured_at)
      .sort((a, b) => (a.captured_at ?? "").localeCompare(b.captured_at ?? ""))
      .map((p) => ({ lat: p.lat, lon: p.lng }));
    let sum = 0;
    for (let i = 1; i < pts.length; i++) sum += haversineKm(pts[i - 1], pts[i]);
    return sum;
  }, [track]);

  const fuelTotal = useMemo(() => fuel.reduce((a, r) => a + (r.total_paid ?? 0), 0), [fuel]);
  const tollTotal = useMemo(() => toll.reduce((a, r) => a + (r.amount ?? 0), 0), [toll]);
  const grandTotal = useMemo(() => fuelTotal + tollTotal, [fuelTotal, tollTotal]);

  function resetStopForm() {
    setInsertAt(null);
    setKind("stop");
    setTitle("");
    setNotes("");
    setArrivedAt("");
    setDepartedAt("");
  }

  async function loadAll() {
    setMsg("");
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setMsg("Auth session missing! (Login opnieuw in /)");
      return;
    }
    setEmail(user.email ?? "");

    const s1 = await supabase
      .from("trip_stops")
      .select("*")
      .eq("trip_id", tripId)
      .order("stop_index", { ascending: true });
    if (s1.error) throw s1.error;
    setStops(s1.data ?? []);

    const f1 = await supabase
      .from("fuel_logs")
      .select("id,filled_at,stop_id,country_code,odometer_km,liters,total_paid,price_per_l,trip_id,user_id,created_at")
      .eq("trip_id", tripId)
      .order("filled_at", { ascending: false });
    if (f1.error) throw f1.error;
    setFuel(f1.data ?? []);

    const t1 = await supabase
      .from("toll_logs")
      .select("*")
      .eq("trip_id", tripId)
      .order("paid_at", { ascending: false });
    if (t1.error) throw t1.error;
    setToll(t1.data ?? []);

    const tr = await supabase
      .from("trip_track_points")
      .select("id,trip_id,user_id,lat,lng,accuracy_m,speed,heading,captured_at,created_at")
      .eq("trip_id", tripId)
      .order("captured_at", { ascending: true })
      .limit(5000);
    if (tr.error) throw tr.error;
    setTrack(tr.data ?? []);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadAll();
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? String(e));
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      if (!mounted) return;
      try {
        await loadAll();
      } catch {}
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function addStop() {
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) throw new Error("Auth session missing");

      const maxIndex = stops.length ? Math.max(...stops.map((s) => s.stop_index)) : 0;
      const targetIndex = insertAt ?? maxIndex + 1;

      const payload: any = {
        title:
          title?.trim() ||
          (kind === "start" ? "Vertrekpunt (thuis)" : kind === "end" ? "Eindpunt (thuis)" : "Stop"),
        kind,
        notes: notes?.trim() || null,
        arrived_at: arrivedAt ? new Date(arrivedAt).toISOString() : null,
        departed_at: departedAt ? new Date(departedAt).toISOString() : null,
      };

      const { error } = await supabase.rpc("insert_stop_at", {
        p_trip_id: tripId,
        p_index: targetIndex,
        p_payload: payload,
      });

      if (error) throw error;

      await loadAll();
      resetStopForm();
    } catch (e: any) {
      console.error("addStop error", e);
      setMsg(e?.message ?? String(e));
    }
  }

  async function moveStop(from: number, to: number) {
    setMsg("");
    try {
      const { error } = await supabase.rpc("move_stop", { p_trip_id: tripId, p_from: from, p_to: to });
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function deleteStop(stopId: string) {
    if (!confirm("Stop verwijderen?")) return;
    setMsg("");
    try {
      const { error } = await supabase.rpc("delete_stop_and_reindex", { p_stop_id: stopId });
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function addFuel() {
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) throw new Error("Auth session missing");

      const row = {
        user_id: userId,
        trip_id: tripId,
        stop_id: fuelStopId || null,
        filled_at: fuelDate ? new Date(fuelDate).toISOString() : new Date().toISOString(),
        country_code: fuelCountry || null,
        odometer_km: odoKm ? Number(odoKm) : null,
        liters: liters ? Number(liters) : null,
        total_paid: paid ? Number(paid) : null,
      };

      const { error } = await supabase.from("fuel_logs").insert(row);
      if (error) throw error;

      setFuelStopId("");
      setFuelDate("");
      setOdoKm("");
      setLiters("");
      setPaid("");
      setFuelCountry("");
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function addToll() {
    setMsg("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) throw new Error("Auth session missing");

      const row = {
        user_id: userId,
        trip_id: tripId,
        paid_at: tollDate ? new Date(tollDate).toISOString() : new Date().toISOString(),
        country_code: tollCountry || null,
        road_name: tollRoad || null,
        amount: Number(tollAmount || 0),
        notes: tollNotes || null,
      };

      const { error } = await supabase.from("toll_logs").insert(row);
      if (error) throw error;

      setTollDate("");
      setTollAmount("");
      setTollCountry("");
      setTollRoad("");
      setTollNotes("");
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  async function toggleTracking() {
    setMsg("");
    try {
      if (!tracking) {
        await startTracking(tripId);
        setTracking(true);
      } else {
        await stopTracking();
        setTracking(false);
      }
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <div className="text-3xl font-bold">Trip</div>
          <div className="text-sm opacity-70">Ingelogd als: {email || "..."}</div>
        </div>

        <div className="flex gap-2">
          <button className="border rounded-xl px-4 py-2" onClick={() => router.push("/")}>
            Trips
          </button>
          <button className="border rounded-xl px-4 py-2" onClick={() => router.push("/settings")}>
            Instellingen
          </button>
          <button className="border rounded-xl px-4 py-2" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`border rounded-xl px-4 py-2 ${tab === "stops" ? "font-bold" : ""}`} onClick={() => setTab("stops")}>
          Stops
        </button>
        <button className={`border rounded-xl px-4 py-2 ${tab === "fuel" ? "font-bold" : ""}`} onClick={() => setTab("fuel")}>
          Tankbeurten
        </button>
        <button className={`border rounded-xl px-4 py-2 ${tab === "toll" ? "font-bold" : ""}`} onClick={() => setTab("toll")}>
          Tol
        </button>
        <button className={`border rounded-xl px-4 py-2 ${tab === "map" ? "font-bold" : ""}`} onClick={() => setTab("map")}>
          Kaart
        </button>

        <button className="ml-auto border rounded-xl px-4 py-2" onClick={toggleTracking}>
          {tracking ? "Stop tracking" : "Start tracking"}
        </button>
      </div>

      {msg && <div className="border rounded-xl p-3 mb-4">{msg}</div>}

      <div className="border rounded-2xl p-4 mb-6">
        <div className="font-semibold mb-2">Totals</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Gepland (lijn) km:</div>
          <div className="text-right">{plannedKm.toFixed(1)} km</div>
          <div>Effectief gereden km:</div>
          <div className="text-right">{actualKm.toFixed(1)} km</div>
          <div>Tank (totaal):</div>
          <div className="text-right">€ {fuelTotal.toFixed(2)}</div>
          <div>Tol (totaal):</div>
          <div className="text-right">€ {tollTotal.toFixed(2)}</div>
          <div className="font-semibold">Totaal reis:</div>
          <div className="text-right font-semibold">€ {grandTotal.toFixed(2)}</div>
        </div>
      </div>

      {tab === "map" && (
        <div className="space-y-4">
          <TripMap
            stops={stopsForMap as any}
            track={
              track.map((p) => ({
                id: p.id,
                recorded_at: p.captured_at ?? "",
                lat: p.lat,
                lon: p.lng,
              })) as any
            }
          />
        </div>
      )}

      {/* De rest (stops/fuel/toll UI) blijft zoals in je huidige file */}
      {/* Je mag hier letterlijk je bestaande blocks laten staan als je wil. */}
      {tab !== "map" && (
        <div className="opacity-70 text-sm">
          (Stops / Tankbeurten / Tol UI blijft ongewijzigd — alleen Supabase init is gestandaardiseerd.)
        </div>
      )}
    </div>
  );
}
