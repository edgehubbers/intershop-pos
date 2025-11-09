// app/routes/dashboard/analytics.tsx
// ====================================================
// Dashboard Analytics (Supabase + Recharts) Minimal UI
// ====================================================

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PieLabelRenderProps } from "recharts"; // 👈 FIX TIPOS label Pie
import {
  DollarSign,
  TrendingUp,
  Package,
  RefreshCw,
  Users,
  Calendar,
  Filter,
} from "lucide-react";

// ---------- Supabase ----------
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ---------- Constantes ----------
const COLORS = [
  "#1f2937", // gray-800
  "#4b5563", // gray-600
  "#6b7280", // gray-500
  "#9ca3af", // gray-400
  "#2563eb", // blue-600
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
];

const FILTROS_TIEMPO = [
  { label: "Hoy", dias: 1 },
  { label: "7 días", dias: 7 },
  { label: "30 días", dias: 30 },
  { label: "90 días", dias: 90 },
  { label: "180 días", dias: 180 },
  { label: "1 año", dias: 365 },
];

// ---------- Tipos (RPC) ----------
type VentaRPC = { fecha: string; total: number | string };
type ProductoTopRPC = { nombre: string; cantidad_vendida: number };
type ProductoStockRPC = {
  nombre: string;
  categoria: string;
  stock: number;
  precio_venta: number;
};
type ClienteRPC = {
  nombre: string;
  total_compras: number;
  cantidad_visitas: number;
  puntos_acumulados: number;
  ultima_compra: string;
};
type CategoriaRPC = { categoria: string; total_ventas: number; porcentaje: number };
type ResumenStockRPC = {
  productos_stock_critico: number;
  productos_stock_bajo: number;
  productos_stock_ok: number;
  valor_total_inventario: number;
};
type MetricasRPC = {
  ventas_hoy: number;
  ventas_mes: number;
  productos_bajo_stock: number;
  total_clientes: number;
  ticket_promedio: number;
};

// ---------- Helpers ----------
const formatMoney = (v: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
  }).format(v || 0);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// Tooltip del Pie (anillo)
type PiePayloadItem = {
  name: string;
  value: number;
  payload: { porcentaje: number };
};
const CustomTooltipAnillo: React.FC<{
  active?: boolean;
  payload?: PiePayloadItem[];
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm shadow-sm">
        <div className="font-medium text-gray-900">{item.name}</div>
        <div className="text-gray-700">{formatMoney(Number(item.value))}</div>
        <div className="text-xs text-gray-500">
          {item.payload.porcentaje.toFixed(1)}% del total
        </div>
      </div>
    );
  }
  return null;
};

// 👇 FIX TIPOS: la función label del Pie debe aceptar PieLabelRenderProps
const renderPieLabel = (props: PieLabelRenderProps) => {
  const percent = typeof props.percent === "number" ? props.percent : 0;
  return `${Math.round(percent * 100)}%`;
};

// ====================================================
// Componente
// ====================================================
const Analytics: React.FC = () => {
  // Estado
  const [filtroActivo, setFiltroActivo] = useState<number>(2); // 30 días
  const [ventas, setVentas] = useState<VentaRPC[]>([]);
  const [productos, setProductos] = useState<ProductoTopRPC[]>([]);
  const [productosStock, setProductosStock] = useState<ProductoStockRPC[]>([]);
  const [clientes, setClientes] = useState<ClienteRPC[]>([]);
  const [categorias, setCategorias] = useState<CategoriaRPC[]>([]);
  const [resumenStock, setResumenStock] = useState<ResumenStockRPC | null>(null);
  const [metricas, setMetricas] = useState<MetricasRPC>({
    ventas_hoy: 0,
    ventas_mes: 0,
    productos_bajo_stock: 0,
    total_clientes: 0,
    ticket_promedio: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Carga
  const cargarDatos = async () => {
    setLoading(true);
    const diasFiltro = FILTROS_TIEMPO[filtroActivo].dias;
    try {
      const [
        ventasRes,
        productosRes,
        metricasRes,
        productosStockRes,
        clientesRes,
        categoriasRes,
        resumenStockRes,
      ] = await Promise.all([
        supabase.rpc("get_ventas_diarias", { p_dias: diasFiltro }),
        supabase.rpc("get_productos_top", { p_limite: 10 }),
        supabase.rpc("get_metricas"),
        supabase.rpc("get_productos_bajo_stock"),
        supabase.rpc("get_clientes_frecuentes", { p_limite: 10 }),
        supabase.rpc("get_ventas_por_categoria"),
        supabase.rpc("get_resumen_stock"),
      ]);

      if (ventasRes.error) console.error("Error ventas:", ventasRes.error);
      if (productosRes.error) console.error("Error productos:", productosRes.error);
      if (metricasRes.error) console.error("Error métricas:", metricasRes.error);
      if (productosStockRes.error) console.error("Error stock:", productosStockRes.error);
      if (clientesRes.error) console.error("Error clientes:", clientesRes.error);
      if (categoriasRes.error) console.error("Error categorías:", categoriasRes.error);
      if (resumenStockRes.error) console.error("Error resumen:", resumenStockRes.error);

      setVentas((ventasRes.data as VentaRPC[]) || []);
      setProductos((productosRes.data as ProductoTopRPC[]) || []);
      setProductosStock((productosStockRes.data as ProductoStockRPC[]) || []);
      setClientes((clientesRes.data as ClienteRPC[]) || []);
      setCategorias((categoriasRes.data as CategoriaRPC[]) || []);
      setResumenStock(
        (resumenStockRes.data?.[0] as ResumenStockRPC | undefined) ?? null
      );
      if (metricasRes.data && (metricasRes.data as MetricasRPC[]).length > 0) {
        setMetricas((metricasRes.data as MetricasRPC[])[0]);
      }
    } catch (e) {
      console.error("❌ Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroActivo]);

  // Derivados para gráficas
  const ventasChart = ventas.map((v) => ({
    fecha: new Date(v.fecha).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    }),
    ventas: Number(v.total),
  }));

  const productosChart = productos.slice(0, 10).map((p) => ({
    nombre: p.nombre.length > 16 ? p.nombre.slice(0, 16) + "…" : p.nombre,
    nombreCompleto: p.nombre,
    cantidad: Number(p.cantidad_vendida),
  }));

  const categoriasChart = categorias.map((c) => ({
    name: c.categoria,
    value: Number(c.total_ventas),
    porcentaje: Number(c.porcentaje),
  }));

  // UI minimalista
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando analytics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-6 lg:p-8 space-y-6">
      {/* Header: título + filtros + acción */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            Analytics
          </h1>
          <p className="text-sm text-gray-500">Resumen y tendencias</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <div className="flex gap-1">
              {FILTROS_TIEMPO.map((f, i) => (
                <button
                  key={f.label}
                  onClick={() => setFiltroActivo(i)}
                  className={`px-3 py-1.5 text-xs rounded-md border ${
                    filtroActivo === i
                      ? "border-gray-900 text-gray-900"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={cargarDatos}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </header>

      {/* Métricas */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4 text-gray-500" />}
          label="Ventas hoy"
          value={formatMoney(metricas.ventas_hoy)}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4 text-gray-500" />}
          label="Ventas del mes"
          value={formatMoney(metricas.ventas_mes)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-gray-500" />}
          label="Ticket promedio"
          value={formatMoney(metricas.ticket_promedio)}
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-gray-500" />}
          label="Clientes"
          value={String(metricas.total_clientes)}
        />
      </section>

      {/* Gráficas principales */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ventas */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Evolución de ventas</h2>
            <span className="text-xs text-gray-500">{FILTROS_TIEMPO[filtroActivo].label}</span>
          </div>

          {ventasChart.length ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ventasChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="fecha" stroke="#6b7280" fontSize={12} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    formatter={(v: number) => formatMoney(Number(v))}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#111827"
                    strokeWidth={2}
                    dot={false}
                    name="Ventas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty state="Sin datos para este período" />
          )}
        </div>

        {/* Por categoría */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Por categoría</h2>
          </div>

          {categoriasChart.length ? (
            <>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoriasChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={84}
                      paddingAngle={4}
                      dataKey="value"
                      label={renderPieLabel} // 👈 función tipada
                      labelLine={false}
                    >
                      {categoriasChart.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltipAnillo />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="mt-3 space-y-1.5">
                {categoriasChart.map((c, idx) => (
                  <li key={c.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-gray-700">{c.name}</span>
                    </div>
                    <span className="text-gray-600">{c.porcentaje.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty state="Sin categorías" />
          )}
        </div>
      </section>

      {/* Top productos + Bajo stock */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top productos */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Top productos</h2>
          </div>
          {productosChart.length ? (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productosChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="nombre"
                    stroke="#6b7280"
                    fontSize={11}
                    angle={-20}
                    height={60}
                    textAnchor="end"
                  />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip
                    formatter={(v: number, _name: string, props: any) => [
                      `${v} unidades`,
                      props?.payload?.nombreCompleto ?? "Producto",
                    ]}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="cantidad" fill="#111827" radius={[4, 4, 0, 0]} name="Unidades" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty state="Sin productos" />
          )}
        </div>

        {/* Bajo stock */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Productos con stock bajo</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Package className="h-4 w-4" />
              {resumenStock ? (
                <span>
                  Crítico: <b>{resumenStock.productos_stock_critico}</b> · Bajo:{" "}
                  <b>{resumenStock.productos_stock_bajo}</b>
                </span>
              ) : null}
            </div>
          </div>

          {productosStock.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="py-2 px-3 text-left">Estado</th>
                    <th className="py-2 px-3 text-left">Producto</th>
                    <th className="py-2 px-3 text-left">Categoría</th>
                    <th className="py-2 px-3 text-right">Stock</th>
                    <th className="py-2 px-3 text-right">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productosStock.map((p, i) => (
                    <tr key={`${p.nombre}-${i}`}>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs ${
                            p.stock < 5
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : "bg-amber-100 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {p.stock < 5 ? "Crítico" : "Bajo"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-800">{p.nombre}</td>
                      <td className="py-2 px-3 text-gray-600">{p.categoria}</td>
                      <td className="py-2 px-3 text-right text-gray-800 font-medium">
                        {p.stock}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-700">
                        {formatMoney(p.precio_venta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty state="Inventario en orden" icon={<Package className="h-4 w-4" />} />
          )}
        </div>
      </section>

      {/* Clientes frecuentes */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Clientes frecuentes</h2>
        </div>

        {clientes.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="py-2 px-3 text-left">#</th>
                  <th className="py-2 px-3 text-left">Cliente</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3 text-right">Visitas</th>
                  <th className="py-2 px-3 text-right">Puntos</th>
                  <th className="py-2 px-3 text-left">Última compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientes.map((c, i) => (
                  <tr key={`${c.nombre}-${i}`}>
                    <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                    <td className="py-2 px-3 text-gray-800">{c.nombre}</td>
                    <td className="py-2 px-3 text-right text-gray-800 font-medium">
                      {formatMoney(c.total_compras)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">{c.cantidad_visitas}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{c.puntos_acumulados}</td>
                    <td className="py-2 px-3 text-gray-600">{formatDate(c.ultima_compra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty state="Sin clientes frecuentes" icon={<Users className="h-4 w-4" />} />
        )}
      </section>
    </div>
  );
};

// ---------- UI auxiliares minimal ----------
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Empty({ state, icon }: { state: string; icon?: React.ReactNode }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">
      <div className="flex items-center gap-2">
        {icon ?? <Calendar className="h-4 w-4" />}
        <span>{state}</span>
      </div>
    </div>
  );
}

export default Analytics;
