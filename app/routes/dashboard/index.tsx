// app/routes/dashboard/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { createClient } from "@supabase/supabase-js";

// ---------- Supabase client (frontend) ----------
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ---------- Helpers ----------
const mxn = (v: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);

const startEndOfTodayISO = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  // Convert to UTC ISO to match typical Postgres timestamps
  const toUTC = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  return { from: toUTC(start), to: toUTC(end) };
};

// ---------- Types (minimal) ----------
type VentaRow = { fecha: string; total: number | string };
type LowStockRow = { nombre: string; stock: number; precio_venta: number };

// ===================================================
// Dashboard Home
//  - KPIs en vivo desde Supabase
//  - Accesos rápidos a tus rutas
//  - Vistas rápidas: últimas ventas & stock bajo
// ===================================================
export default function DashboardHome() {
  const [{ ventasHoy, ticketsHoy, productos, clientes, pendientes }, setKpis] =
    useState({
      ventasHoy: 0,
      ticketsHoy: 0,
      productos: 0,
      clientes: 0,
      pendientes: 0,
    });

  const [ultimasVentas, setUltimasVentas] = useState<VentaRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const stats = useMemo(
    () => [
      { label: "Ventas Hoy", value: mxn(ventasHoy), icon: "💰" },
      { label: "Productos", value: String(productos), icon: "📦" },
      { label: "Clientes", value: String(clientes), icon: "👥" },
      { label: "Tickets (hoy)", value: String(ticketsHoy), icon: "🧾" },
    ],
    [ventasHoy, productos, clientes, ticketsHoy]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { from, to } = startEndOfTodayISO();

        // Ventas de HOY (sum & count) + últimas 5
        const ventasRes = await supabase
          .from("ventas")
          .select("total,fecha", { count: "exact" })
          .gte("fecha", from)
          .lte("fecha", to)
          .order("fecha", { ascending: false })
          .limit(5);

        const ventasList = (ventasRes.data as VentaRow[]) ?? [];
        const ventasSum = ventasList.reduce(
          (acc, r) => acc + Number(r.total || 0),
          0
        );
        const ventasCount = ventasRes.count ?? ventasList.length;

        // Conteo de productos
        const prodRes = await supabase
          .from("productos")
          .select("id", { count: "exact", head: true });

        // Conteo de clientes
        const cliRes = await supabase
          .from("clientes")
          .select("id", { count: "exact", head: true });

        // Pedidos pendientes (para referencia rápida)
        const pendRes = await supabase
          .from("pedidos_online")
          .select("id", { count: "exact", head: true })
          .eq("estado", "pendiente");

        // Stock bajo (umbral 5 unidades)
        const lowRes = await supabase
          .from("productos")
          .select("nombre,stock,precio_venta")
          .lt("stock", 5)
          .order("stock", { ascending: true })
          .limit(5);

        setKpis({
          ventasHoy: ventasSum,
          ticketsHoy: ventasCount,
          productos: prodRes.count ?? 0,
          clientes: cliRes.count ?? 0,
          pendientes: pendRes.count ?? 0,
        });
        setUltimasVentas(ventasList);
        setLowStock((lowRes.data as LowStockRow[]) ?? []);
      } catch (e) {
        console.error("Dashboard KPIs error:", e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            Bienvenido
          </h2>
          <p className="text-gray-600">
            Resumen de tu negocio y accesos rápidos
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/analytics"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition"
            title="Ir a Analytics"
          >
            📊 Ver Analytics
          </Link>
          <Link
            to="/dashboard/chatbot"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-black transition"
            title="Ir al Copiloto"
          >
            🤖 Copiloto
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {loading ? (
                <span className="inline-block h-6 w-24 rounded bg-gray-100 animate-pulse" />
              ) : (
                stat.value
              )}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions / Accesos */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Acciones y Accesos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickLink to="/dashboard/pos" icon="➕" title="Nueva Venta" desc="Registrar venta" />
          <QuickLink
            to="/dashboard/products"
            icon="📦"
            title="Productos"
            desc="Crear / editar"
          />
          <QuickLink
            to="/dashboard/sales"
            icon="🧾"
            title="Ventas"
            desc="Historial"
          />
          <QuickLink
            to="/dashboard/tienda-online"
            icon="🛒"
            title="Tienda Online"
            desc="Catálogo público"
          />
          <QuickLink
            to="/dashboard/analytics"
            icon="📊"
            title="Analytics"
            desc="Reportes"
          />
          <QuickLink
            to="/dashboard/chatbot"
            icon="🤖"
            title="Copiloto IA"
            desc="Preguntar con datos"
          />
        </div>
        {/** hint de pendientes */}
        <p className="mt-4 text-sm text-gray-600">
          Pedidos pendientes:{" "}
          <b className="text-gray-900">{pendientes}</b>
        </p>
      </div>

      {/* Two columns: Últimas ventas & Bajo stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas ventas */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Últimas ventas</h3>
            <Link
              to="/dashboard/sales"
              className="text-sm text-blue-700 hover:underline"
            >
              Ver todas →
            </Link>
          </div>

          {loading ? (
            <SkeletonList rows={5} />
          ) : ultimasVentas.length ? (
            <ul className="divide-y divide-gray-100">
              {ultimasVentas.map((v, i) => (
                <li key={i} className="py-3 flex items-center justify-between">
                  <span className="text-gray-700">
                    {new Date(v.fecha).toLocaleString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {mxn(Number(v.total))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Aún no hay ventas hoy" />
          )}
        </div>

        {/* Bajo stock */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Stock bajo</h3>
            <Link
              to="/dashboard/products"
              className="text-sm text-blue-700 hover:underline"
            >
              Administrar →
            </Link>
          </div>

          {loading ? (
            <SkeletonList rows={5} />
          ) : lowStock.length ? (
            <ul className="divide-y divide-gray-100">
              {lowStock.map((p, i) => (
                <li
                  key={`${p.nombre}-${i}`}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="min-w-0 mr-3">
                    <div className="truncate text-gray-900">{p.nombre}</div>
                    <div className="text-xs text-gray-500">
                      Precio: {mxn(p.precio_venta)}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                      p.stock < 5
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-amber-100 text-amber-700 border border-amber-200"
                    }`}
                    title="Unidades en inventario"
                  >
                    {p.stock} ud.
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Todo el inventario está en niveles saludables" />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Small UI pieces ----------
function QuickLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <div className="text-left">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{desc}</div>
      </div>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-sm text-gray-500 h-[140px] flex items-center justify-center">
      {text}
    </div>
  );
}

function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="py-3 flex items-center justify-between">
          <span className="inline-block h-4 w-40 bg-gray-100 rounded animate-pulse" />
          <span className="inline-block h-4 w-20 bg-gray-100 rounded animate-pulse" />
        </li>
      ))}
    </ul>
  );
}
