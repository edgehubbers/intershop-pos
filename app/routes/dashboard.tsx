import type { Route } from "./+types/dashboard";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase.client";

export async function loader({}: Route.LoaderArgs) {
  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <section className="rounded-2xl border p-6 space-y-3">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="opacity-80">Sesión como: <span className="font-medium">{email ?? "—"}</span></p>
      <div className="flex gap-2">
        <button onClick={() => navigate("/")} className="px-3 py-2 rounded border">Inicio</button>
        <button onClick={logout} className="px-3 py-2 rounded border">Cerrar sesión</button>
      </div>
    </section>
  );
}
