"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";

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
];

const FUEL_TYPES = [
  { value: "benzine", label: "Benzine" },
  { value: "diesel", label: "Diesel" },
  { value: "lpg", label: "LPG" },
  { value: "hybride", label: "Hybride" },
  { value: "elektrisch", label: "Elektrisch" },
];

export default function SettingsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // profile
  const [nickname, setNickname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [bus, setBus] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("België");

  // vehicle
  const [vehicleKind, setVehicleKind] = useState("camper");
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [fuelType, setFuelType] = useState("diesel");
  const [avgConsumption, setAvgConsumption] = useState<string>("");
  const [tankCapacity, setTankCapacity] = useState<string>("");

  const vehicleNeedsFuel = vehicleKind === "auto" || vehicleKind === "auto_caravan" || vehicleKind === "camper";

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);

      const { data: s } = await supabase.auth.getSession();
      const session = s.session;
      if (!session) {
        router.replace("/login?next=%2Fsettings");
        return;
      }

      const uid = session.user.id;

      // load profile
      const { data: p } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (p) {
        setNickname(p.nickname || "");
        setFirstName(p.first_name || "");
        setLastName(p.last_name || "");
        setStreet(p.street || "");
        setHouseNumber(p.house_number || "");
        setBus(p.bus || "");
        setPostalCode(p.postal_code || "");
        setCity(p.city || "");
        setCountry(p.country || "België");
      }

      // load vehicle
      const { data: c } = await supabase
        .from("camper_profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (c) {
        setVehicleKind(c.vehicle_kind || "camper");
        setVehicleName(c.vehicle_name || "");
        setVehicleModel(c.vehicle_model || "");
        setFuelType(c.fuel_type || "diesel");
        setAvgConsumption(c.avg_consumption != null ? String(c.avg_consumption) : "");
        setTankCapacity(c.tank_capacity != null ? String(c.tank_capacity) : "");
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const session = s.session;
      if (!session) {
        router.replace("/login?next=%2Fsettings");
        return;
      }
      const uid = session.user.id;

      const { error: pErr } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: uid,
            nickname: nickname.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            street: street.trim(),
            house_number: houseNumber.trim(),
            bus: bus.trim() || null,
            postal_code: postalCode.trim(),
            city: city.trim(),
            country: country.trim(),
          },
          { onConflict: "user_id" }
        );

      if (pErr) {
        setMsg(pErr.message);
        return;
      }

      const { error: cErr } = await supabase
        .from("camper_profiles")
        .upsert(
          {
            user_id: uid,
            vehicle_kind: vehicleKind,
            vehicle_name: vehicleName.trim(),
            vehicle_model: vehicleModel.trim() || null,
            fuel_type: vehicleNeedsFuel ? fuelType : null,
            avg_consumption: vehicleNeedsFuel && avgConsumption ? Number(avgConsumption) : null,
            tank_capacity: vehicleNeedsFuel && tankCapacity ? Number(tankCapacity) : null,
          },
          { onConflict: "user_id" }
        );

      if (cErr) {
        setMsg(cErr.message);
        return;
      }

      setMsg("Opgeslagen ✅");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="p-6 max-w-3xl mx-auto">Laden...</main>;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Instellingen</h1>
        <button className="border rounded-lg px-3 py-2" onClick={() => router.push("/trips")}>
          Terug
        </button>
      </div>

      <div className="border rounded-2xl p-4 mt-6">
        <h2 className="text-xl font-semibold mb-3">Account</h2>

        <label className="block text-sm font-medium mb-1">Nickname</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-3" value={nickname} onChange={(e) => setNickname(e.target.value)} />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Voornaam</label>
            <input className="w-full border rounded-lg px-3 py-2 mb-3" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Naam</label>
            <input className="w-full border rounded-lg px-3 py-2 mb-3" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <h3 className="text-sm font-semibold mt-2 mb-2">Adres (standaard vertrekpunt)</h3>
        <label className="block text-sm font-medium mb-1">Straat</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-2" value={street} onChange={(e) => setStreet(e.target.value)} />

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Nr</label>
            <input className="w-full border rounded-lg px-3 py-2 mb-3" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bus</label>
            <input className="w-full border rounded-lg px-3 py-2 mb-3" value={bus} onChange={(e) => setBus(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Postcode</label>
            <input className="w-full border rounded-lg px-3 py-2 mb-3" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </div>
        </div>

        <label className="block text-sm font-medium mb-1">Gemeente / Stad</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-3" value={city} onChange={(e) => setCity(e.target.value)} />

        <label className="block text-sm font-medium mb-1">Land</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-3" value={country} onChange={(e) => setCountry(e.target.value)} list="eu-countries" />
        <datalist id="eu-countries">
          {EU_COUNTRIES.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div className="border rounded-2xl p-4 mt-6">
        <h2 className="text-xl font-semibold mb-3">Vervoersmiddel</h2>

        <label className="block text-sm font-medium mb-1">Type</label>
        <select className="w-full border rounded-lg px-3 py-2 mb-3" value={vehicleKind} onChange={(e) => setVehicleKind(e.target.value)}>
          {VEHICLE_KINDS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>

        <label className="block text-sm font-medium mb-1">Naam / Type</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-3" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} />

        <label className="block text-sm font-medium mb-1">Model (optioneel)</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-3" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />

        <div className={`grid grid-cols-2 gap-2 ${vehicleNeedsFuel ? "" : "opacity-50"}`}>
          <div>
            <label className="block text-sm font-medium mb-1">Brandstof</label>
            <select className="w-full border rounded-lg px-3 py-2 mb-3" value={fuelType} onChange={(e) => setFuelType(e.target.value)} disabled={!vehicleNeedsFuel}>
              {FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Verbruik (L/100km)</label>
            <input className="w-full border rounded-lg px-3 py-2 mb-3" value={avgConsumption} onChange={(e) => setAvgConsumption(e.target.value)} disabled={!vehicleNeedsFuel} />
          </div>
        </div>

        <label className={`block text-sm font-medium mb-1 ${vehicleNeedsFuel ? "" : "opacity-50"}`}>Tank (liter)</label>
        <input className="w-full border rounded-lg px-3 py-2 mb-3" value={tankCapacity} onChange={(e) => setTankCapacity(e.target.value)} disabled={!vehicleNeedsFuel} />
      </div>

      {msg && <div className="mt-4 border rounded-lg p-2 text-sm">{msg}</div>}

      <button
        className="mt-4 bg-black text-white rounded-lg px-5 py-3 disabled:opacity-60"
        onClick={save}
        disabled={busy}
      >
        {busy ? "Even geduld..." : "Opslaan"}
      </button>
    </main>
  );
}
