"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Mode = "login" | "register" | "reset";

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

export default function LoginClient() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const sp = useSearchParams();
  const nextUrl = sp.get("next") || "/trips";

  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register: account fields
  const [nickname, setNickname] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [bus, setBus] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("België");

  // register: vehicle fields
  const [vehicleKind, setVehicleKind] =
    useState<(typeof VEHICLE_KINDS)[number]["value"]>("camper");
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [fuelType, setFuelType] =
    useState<(typeof FUEL_TYPES)[number]["value"]>("diesel");
  const [avgConsumption, setAvgConsumption] = useState<string>(""); // l/100km
  const [tankCapacity, setTankCapacity] = useState<string>(""); // liters

  const vehicleNeedsFuel =
    vehicleKind === "auto" ||
    vehicleKind === "auto_caravan" ||
    vehicleKind === "camper";

  async function onLogin() {
    setMsg(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return setMsg(error.message);

      if (!data.session) {
        return setMsg("Login gelukt, maar geen sessie. (E-mail confirm?)");
      }
      router.replace(nextUrl);
    } catch (e: any) {
      setMsg(e?.message || "Onbekende fout bij login.");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${location.origin}/reset-password`,
      });
      if (error) return setMsg(error.message);
      setMsg("Reset e-mail verstuurd. Check je inbox.");
    } catch (e: any) {
      setMsg(e?.message || "Onbekende fout bij reset.");
    } finally {
      setBusy(false);
    }
  }

  async function onRegister() {
    setMsg(null);

    // verplicht
    if (!nickname.trim()) return setMsg("Nickname is verplicht.");
    if (!firstName.trim()) return setMsg("Voornaam is verplicht.");
    if (!lastName.trim()) return setMsg("Naam is verplicht.");
    if (!street.trim()) return setMsg("Straat is verplicht.");
    if (!houseNumber.trim()) return setMsg("Nr is verplicht.");
    if (!postalCode.trim()) return setMsg("Postcode is verplicht.");
    if (!city.trim()) return setMsg("Gemeente/Stad is verplicht.");
    if (!country.trim()) return setMsg("Land is verplicht.");
    if (!email.trim()) return setMsg("E-mail is verplicht.");
    if (!password) return setMsg("Wachtwoord is verplicht.");
    if (!vehicleName.trim())
      return setMsg("Geef een naam/type voor je vervoersmiddel (bv. 'Camper Swa').");

    setBusy(true);
    try {
      // ✅ Alles in metadata: DB trigger maakt user_profiles + user_vehicles aan
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nickname: nickname.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),

            street: street.trim(),
            house_number: houseNumber.trim(),
            box: bus.trim() || "",
            postal_code: postalCode.trim(),
            city: city.trim(),
            country: country.trim(),

            vehicle_kind: vehicleKind,
            vehicle_name: vehicleName.trim(),
            vehicle_model: vehicleModel.trim() || "",
            fuel_type: vehicleNeedsFuel ? fuelType : "",
            avg_consumption: vehicleNeedsFuel ? avgConsumption.trim() : "",
            tank_capacity: vehicleNeedsFuel ? tankCapacity.trim() : "",
          },
        },
      });

      if (error) return setMsg(error.message);

      // Als confirm email aan staat: session is null → gebruiker moet eerst mail bevestigen
      if (!data.session) {
        setMsg("Account aangemaakt. Bevestig je e-mail en log daarna in.");
        setMode("login");
        return;
      }

      router.replace(nextUrl);
    } catch (e: any) {
      setMsg(e?.message || "Onbekende fout bij registreren.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-xl flex flex-col items-center">
        {/* Logo: groot + dichter bij tekst */}
        <div className="flex flex-col items-center gap-1 mb-3">
          <Image
            src="/brand/drivemapz-logo.png"
            alt="DriveMapz"
            width={280}
            height={280}
            priority
          />
          <h1 className="text-4xl font-bold leading-tight -mt-4">DriveMapz</h1>
          <p className="text-sm text-neutral-600 -mt-2">
            Trips • Stops • Fuel • Toll • Tracking
          </p>
        </div>

        <div className="w-full max-w-md border rounded-2xl p-4">
          <div className="flex gap-2 mb-4">
            <button
              className={`px-3 py-2 rounded-lg border ${mode === "login" ? "bg-black text-white" : ""}`}
              onClick={() => { setMode("login"); setMsg(null); }}
              type="button"
            >
              Login
            </button>
            <button
              className={`px-3 py-2 rounded-lg border ${mode === "register" ? "bg-black text-white" : ""}`}
              onClick={() => { setMode("register"); setMsg(null); }}
              type="button"
            >
              Registreren
            </button>
            <button
              className={`ml-auto px-3 py-2 rounded-lg border ${mode === "reset" ? "bg-black text-white" : ""}`}
              onClick={() => { setMode("reset"); setMsg(null); }}
              type="button"
            >
              Wachtwoord vergeten
            </button>
          </div>

          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-3 bg-yellow-50"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jij@voorbeeld.be"
            autoComplete="email"
          />

          {mode !== "reset" && (
            <>
              <label className="block text-sm font-medium mb-1">Wachtwoord</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mb-3 bg-yellow-50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </>
          )}

          {mode === "register" && (
            <>
              <div className="border-t pt-3 mt-2">
                <h2 className="text-sm font-semibold mb-2">Account</h2>

                <label className="block text-sm font-medium mb-1">Nickname</label>
                <input className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={nickname} onChange={(e) => setNickname(e.target.value)} />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Voornaam</label>
                    <input className="w-full border rounded-lg px-3 py-2 mb-3"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Naam</label>
                    <input className="w-full border rounded-lg px-3 py-2 mb-3"
                      value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>

                <h2 className="text-sm font-semibold mb-2 mt-2">Adres (vertrekpunt standaard)</h2>

                <label className="block text-sm font-medium mb-1">Straat</label>
                <input className="w-full border rounded-lg px-3 py-2 mb-2"
                  value={street} onChange={(e) => setStreet(e.target.value)} />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nr</label>
                    <input className="w-full border rounded-lg px-3 py-2 mb-3"
                      value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bus</label>
                    <input className="w-full border rounded-lg px-3 py-2 mb-3"
                      value={bus} onChange={(e) => setBus(e.target.value)} placeholder="Optioneel" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Postcode</label>
                    <input className="w-full border rounded-lg px-3 py-2 mb-3"
                      value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                  </div>
                </div>

                <label className="block text-sm font-medium mb-1">Gemeente / Stad</label>
                <input className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={city} onChange={(e) => setCity(e.target.value)} />

                <label className="block text-sm font-medium mb-1">Land</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  list="eu-countries"
                />
                <datalist id="eu-countries">
                  {EU_COUNTRIES.map((c) => <option key={c} value={c} />)}
                </datalist>

                <h2 className="text-sm font-semibold mb-2 mt-2">Vervoersmiddel</h2>

                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={vehicleKind} onChange={(e) => setVehicleKind(e.target.value as any)}>
                  {VEHICLE_KINDS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>

                <label className="block text-sm font-medium mb-1">Naam / Type</label>
                <input className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} />

                <label className="block text-sm font-medium mb-1">Model (optioneel)</label>
                <input className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />

                <div className={`grid grid-cols-2 gap-2 ${vehicleNeedsFuel ? "" : "opacity-50"}`}>
                  <div>
                    <label className="block text-sm font-medium mb-1">Brandstof</label>
                    <select className="w-full border rounded-lg px-3 py-2 mb-3"
                      value={fuelType} onChange={(e) => setFuelType(e.target.value as any)}
                      disabled={!vehicleNeedsFuel}>
                      {FUEL_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Verbruik (L/100km)</label>
                    <input className="w-full border rounded-lg px-3 py-2 mb-3"
                      value={avgConsumption} onChange={(e) => setAvgConsumption(e.target.value)}
                      disabled={!vehicleNeedsFuel} inputMode="decimal" />
                  </div>
                </div>

                <label className={`block text-sm font-medium mb-1 ${vehicleNeedsFuel ? "" : "opacity-50"}`}>
                  Tank (liter)
                </label>
                <input className="w-full border rounded-lg px-3 py-2 mb-3"
                  value={tankCapacity} onChange={(e) => setTankCapacity(e.target.value)}
                  disabled={!vehicleNeedsFuel} inputMode="decimal" />
              </div>
            </>
          )}

          {msg && <div className="mt-2 mb-2 text-sm border rounded-lg p-2">{msg}</div>}

          {mode === "login" && (
            <button className="w-full rounded-lg bg-black text-white py-3 disabled:opacity-60"
              onClick={onLogin} disabled={busy} type="button">
              {busy ? "Even geduld..." : "Login"}
            </button>
          )}

          {mode === "register" && (
            <button className="w-full rounded-lg bg-black text-white py-3 disabled:opacity-60"
              onClick={onRegister} disabled={busy} type="button">
              {busy ? "Even geduld..." : "Account maken"}
            </button>
          )}

          {mode === "reset" && (
            <button className="w-full rounded-lg bg-black text-white py-3 disabled:opacity-60"
              onClick={onReset} disabled={busy} type="button">
              {busy ? "Even geduld..." : "Reset e-mail sturen"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
