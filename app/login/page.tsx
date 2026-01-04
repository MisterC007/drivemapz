"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = useMemo(() => supabaseBrowser, []);
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // als je al ingelogd bent → door naar home
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    try {
      if (!email.trim() || !password.trim()) {
        setMsg("Vul e-mail en wachtwoord in.");
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setMsg("Account aangemaakt. Check je e-mail om te bevestigen, daarna kan je inloggen.");
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      router.replace("/");
    } catch (err: any) {
      setMsg(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">DriveMapz</h1>
        <p className="text-sm text-gray-600 mt-1">
          {mode === "login" ? "Login met je account" : "Maak een nieuw account"}
        </p>

        <div className="flex gap-2 mt-4">
          <button
            className={`px-3 py-2 rounded-lg border ${mode === "login" ? "bg-black text-white" : ""}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`px-3 py-2 rounded-lg border ${mode === "signup" ? "bg-black text-white" : ""}`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Signup
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="text-sm">E-mail</label>
            <input
              className="w-full mt-1 p-2 border rounded-lg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="jij@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm">Wachtwoord</label>
            <input
              className="w-full mt-1 p-2 border rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {msg && <div className="text-sm rounded-lg bg-gray-50 border p-2">{msg}</div>}

          <button
            className="w-full py-2 rounded-lg bg-black text-white disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? "Bezig..." : mode === "login" ? "Login" : "Account maken"}
          </button>
        </form>
      </div>
    </div>
  );
}
