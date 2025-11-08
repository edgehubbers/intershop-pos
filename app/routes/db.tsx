//app\routes\db.tsx

import type { Route } from "./+types/db";
import { useLoaderData } from "react-router";
import { getSupabaseServer } from "../lib/supabase.server";

export async function loader({}: Route.LoaderArgs) {
  const supabase = getSupabaseServer();

  // ¿Existe la tabla y puedo leerla?
  const read = await supabase.from("products").select("*").limit(5);

  // Si la tabla NO existe, el mensaje típico es algo como:
  // "Could not find the table 'public.products' in the schema cache"
  if (read.error) {
    return {
      ok: false as const,
      error: read.error.message,
      rows: [] as any[],
      didSeed: false,
    };
  }

  // Si no hay filas, sembramos datos demo (gracias a las políticas dev)
  let didSeed = false;
  if ((read.data?.length ?? 0) === 0) {
    const seed = await supabase.from("products").insert([
      { sku: "SKU-001", name: "Café Americano", price: 1.9, category: "Bebidas", stock: 50 },
      { sku: "SKU-002", name: "Capuchino", price: 2.5, category: "Bebidas", stock: 40 },
      { sku: "SKU-003", name: "Sándwich Jamón", price: 3.9, category: "Comida", stock: 30 },
      { sku: "SKU-004", name: "Brownie", price: 2.2, category: "Postres", stock: 25 },
      { sku: "SKU-005", name: "Agua 600ml", price: 1.0, category: "Bebidas", stock: 100 },
      { sku: "SKU-006", name: "Galletas Mix", price: 1.3, category: "Snacks", stock: 60 },
    ]).select("*");
    if (!seed.error) {
      didSeed = true;
      read.data = seed.data ?? [];
    }
  }

  return {
    ok: true as const,
    error: null as string | null,
    rows: read.data ?? [],
    didSeed,
  };
}

export default function SupabaseTests() {
  const { ok, error, rows, didSeed } = useLoaderData<typeof loader>();

  return (
    <section className="rounded-2xl border p-6 space-y-3">
      <h1 className="text-xl font-semibold">Supabase — pruebas</h1>
      <p className="opacity-80">
        Estado:{" "}
        <span className={ok ? "text-green-600" : "text-red-600"}>
          {ok ? "conectado ✅" : "error ❌"}
        </span>
      </p>

      {!ok && (
        <div className="text-sm">
          <div className="opacity-70">Detalle del error:</div>
          <pre className="p-3 rounded bg-gray-950/5 overflow-auto">{error}</pre>
          <p className="opacity-70 mt-2">
            Corre el SQL que te pasé en el Dashboard de Supabase (SQL Editor).  
            Luego refresca esta página.
          </p>
        </div>
      )}

      {ok && (
        <div className="text-sm">
          {didSeed && (
            <p className="mb-2">
              Se insertaron productos demo automáticamente 🧪
            </p>
          )}
          <div className="opacity-70 mb-1">
            Primeras filas de <code>products</code>:
          </div>
          <pre className="p-3 rounded bg-gray-950/5 overflow-auto">
            {JSON.stringify(rows, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
