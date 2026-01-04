"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

const EU_COUNTRIES = [
  "België","Nederland","Luxemburg","Duitsland","Frankrijk","Spanje","Portugal","Italië","Oostenrijk","Zwitserland",
  "Verenigd Koninkrijk","Ierland","Denemarken","Zweden","Noorwegen","Finland","IJsland",
  "Polen","Tsjechië","Slowakije","Hongarije","Slovenië","Kroatië","Bosnië en Herzegovina","Servië","Montenegro","Albanië","Noord-Macedonië","Kosovo",
  "Griekenland","Bulgarije","Roemenië","Moldavië","Oekraïne","Wit-Rusland","Litouwen","Letland","Estland",
  "Andorra","Monaco","San Marino","Vaticaanstad","Liechtenstein","Malta","Cyprus","Turkije"
];

const VEHICLE_KINDS = [
  { value: "auto", label: "Auto" },
  { value: "auto_caravan", label: "Auto + Caravan" },
  { value: "camper", label: "Camper" },
  { value: "fiets", label: "Fiets" },
  { value: "te_voet", label: "Te voet" },
] as const;

const FUEL_TYPES = [
  { value: "benzine", label: "Benzine" },
  { value: "diesel", label: "Diesel" },
  { value: "lpg", label: "LPG" },
  { value: "hybride", label: "Hybride" },
  { value: "elektrisch", label: "Elektrisch" },
] as const;

export default function SettingsPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // profile
  const [nickname, setNickname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [bus, setBus] = useState(""); // UI state; DB column = box
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("België");

  // vehicle (UI)
  const [vehicleKind, setVehicleKind] =
    useState<(typeof VEHICLE_KINDS)[number]["value"]>("camper");
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleModel, setVehicleModel] = useState(""); // UI-only (bestaat niet in camper_profiles)
  const [fuelType, setFuelType] =
    useState<(typeof FUEL_TYPES)[number]["value"]>("diesel");
  const [avgConsumption, setAvgConsumption] = useState<string>(""); // maps to consumption_l_per_100km
  const [tankCapacity, setTankCapacity] = useState<string>(""); // maps to tank_capacity_l

  const vehicleNeedsFuel = useMemo(() => {
    return vehicleKind === "auto" || vehicleKind === "auto_caravan" || vehicleKind === "camper";
  }, [vehicleKind]);

  useEffect(() => {
    (async () => {
      setMsg("");
      setBusy(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        const uemail = sess.session?.user?.email ?? "";
        if (!uid) {
          router.replace("/login?next=/settings");
          return;
        }
        setEmail(uemail);

        // Load user profile
        const { data: p, error: pErr } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();

        if (pErr) throw pErr;

        if (p) {
          setNickname(p.nickname || "");
          setFirstName(p.first_name || "");
          setLastName(p.last_name || "");
          setStreet(p.street || "");
          setHouseNumber(p.house_number || "");
          setBus(p.box || ""); // ✅ box in DB
          setPostalCode(p.postal_code || "");
          setCity(p.city || "");
          setCountry(p.country || "België");
        } else {
          // fallback: prefill from auth user metadata if present
          const meta: any = sess.session?.user?.user_metadata || {};
          setNickname(meta.nickname || "");
          setFirstName(meta.first_name || "");
          setLastName(meta.last_name || "");
        }

        // Load camper profile (your current schema)
        const { data: c, error: cErr } = await supabase
          .from("camper_profiles")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();

        if (cErr) throw cErr;

        if (c) {
          setVehicleKind("camper"); // UI-only (no column in DB)
          setVehicleName(c.vehicle_name || "");
          setVehicleModel(""); // UI-only (no column in DB)
          setFuelType((c.fuel_type as any) || "diesel");

          setAvgConsumption(
            c.consumption_l_per_100km != null ? String(c.consumption_l_per_100km) : ""
          );
          setTankCapacity(
            c.tank_capacity_l != null ? String(c.tank_capacity_l) : ""
          );
        }
      } catch (e: any) {
        setMsg(e?.message || "Fout bij laden instellingen.");
      } finally {
        setBusy(false);
      }
    })();
  }, [router, supabase]);

  async function saveAll() {
    setMsg("");
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      const uemail = sess.session?.user?.email ?? "";
      if (!uid) {
        router.replace("/login?next=/settings");
        return;
      }

      // Basic validation (zoals je vroeg: verplichte account velden)
      if (!nickname.trim()) throw new Error("Nickname is verplicht.");
      if (!firstName.trim()) throw new Error("Voornaam is verplicht.");
      if (!lastName.trim()) throw new Error("Naam is verplicht.");
      if (!street.trim()) throw new Error("Straat is verplicht.");
      if (!houseNumber.trim()) throw new Error("Nr is verplicht.");
      if (!postalCode.trim()) throw new Error("Postcode is verplicht.");
      if (!city.trim()) throw new Error("Gemeente/Stad is verplicht.");
      if (!country.trim()) throw new Error("Land is verplicht.");

      // 1) user_profiles upsert (DB column = box)
      const { error: pErr } = await (supabase as any)
        .from("user_profiles")
        .upsert(
          {
            user_id: uid,
            nickname: nickname.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: uemail,
            street: street.trim() || null,
            house_number: houseNumber.trim() || null,
            box: bus.trim() || null,
            postal_code: postalCode.trim() || null,
            city: city.trim() || null,
            country: country.trim() || null,
          },
          { onConflict: "user_id" }
        );

      if (pErr) throw pErr;

      // 2) camper_profiles upsert (match your existing schema)
      const { error: cErr } = await supabase
        .from("camper_profiles")
        .upsert(
          {
            user_id: uid,
            vehicle_name: vehicleName.trim() || null,
            fuel_type: vehicleNeedsFuel ? (fuelType as any) : null,
            consumption_l_per_100km:
              vehicleNeedsFuel && avgConsumption ? Number(avgConsumption) : null,
            tank_capacity_l:
              vehicleNeedsFuel && tankCapacity ? Number(tankCapacity) : null,
          } as any,
          { onConflict: "user_id" }
        );

      if (cErr) throw cErr;

      setMsg("Instellingen opgeslagen.");
    } catch (e: any) {
      setMsg(e?.message || "Fout bij opslaan instellingen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold">Account & Instellingen</h1>
          <div className="ml-auto flex gap-2">
            <button
              className="px-3 py-2 rounded-lg border"
              type="button"
              onClick={() => router.push("/trips")}
              disabled={busy}
            >
              Terug
            </button>
            <button
              className="px-3 py-2 rounded-lg bg-black text-white disabled:opacity-60"
              type="button"
              onClick={saveAll}
              disabled={busy}
            >
              {busy ? "Even geduld..." : "Opslaan"}
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-4 border rounded-lg p-3 text-sm">
            {msg}
          </div>
        )}

        <div className="grid gap-6">
          {/* Profile */}
          <section className="border rounded-2xl p-4">
            <h2 className="text-sm font-semibold mb-3">Account</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nickname</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">E-mail</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-neutral-100"
                  value={email}
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Voornaam</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Naam</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <h3 className="text-sm font-semibold mt-5 mb-3">
              Adres (standaard vertrekpunt)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Straat</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nr</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Bus</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={bus}
                  onChange={(e) => setBus(e.target.value)}
                  placeholder="Optioneel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Postcode</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Gemeente / Stad</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Land</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  list="eu-countries"
                  placeholder="Kies of typ een land"
                />
                <datalist id="eu-countries">
                  {EU_COUNTRIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </section>

          {/* Vehicle */}
          <section className="border rounded-2xl p-4">
            <h2 className="text-sm font-semibold mb-3">Vervoersmiddel</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={vehicleKind}
                  onChange={(e) => setVehicleKind(e.target.value as any)}
                >
                  {VEHICLE_KINDS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  (Type wordt momenteel niet opgeslagen in DB, enkel gebruikt voor berekeningen)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Naam / Type</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  placeholder="bv. Camper Swa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Model (UI-only)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="bv. Roller Team Granduca 2006"
                />
              </div>

              <div className={vehicleNeedsFuel ? "" : "opacity-50"}>
                <label className="block text-sm font-medium mb-1">Brandstof</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as any)}
                  disabled={!vehicleNeedsFuel}
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={vehicleNeedsFuel ? "" : "opacity-50"}>
                <label className="block text-sm font-medium mb-1">
                  Verbruik (L/100km)
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={avgConsumption}
                  onChange={(e) => setAvgConsumption(e.target.value)}
                  disabled={!vehicleNeedsFuel}
                  inputMode="decimal"
                  placeholder="bv. 9.5"
                />
              </div>

              <div className={vehicleNeedsFuel ? "" : "opacity-50"}>
                <label className="block text-sm font-medium mb-1">Tank (liter)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(e.target.value)}
                  disabled={!vehicleNeedsFuel}
                  inputMode="decimal"
                  placeholder="bv. 90"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
