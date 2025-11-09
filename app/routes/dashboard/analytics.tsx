// ============================================
// DASHBOARD CON FILTROS DE TIEMPO
// app/routes/dashboard/analytics.tsx
// ============================================

import React, { useState, useEffect } from "react";
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
import {
  DollarSign,
  TrendingUp,
  Package,
  RefreshCw,
  Users,
  ShoppingCart,
  AlertTriangle,
  Award,
  Calendar,
  Filter as FilterIcon,
} from "lucide-react";

// 👇 Cliente Supabase – usa tus variables públicas de Vite
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

// OPCIONES DE FILTRO
const FILTROS_TIEMPO = [
  { label: "Hoy", dias: 1, meses: 0 },
  { label: "7 días", dias: 7, meses: 0 },
  { label: "30 días", dias: 30, meses: 0 },
  { label: "3 meses", dias: 90, meses: 3 },
  { label: "6 meses", dias: 180, meses: 6 },
  { label: "1 año", dias: 365, meses: 12 },
];

type VentaAgg = { fecha: string; total: number };
type ProductoTop = { nombre: string; cantidad_vendida: number };
type CategoriaAgg = { categoria: string; total_ventas: number; porcentaje: number };
type BajoStock = { nombre: string; categoria: string; stock: number; precio_venta: number };
type ClienteFrecuente = {
  nombre: string;
  total_compras: number;
  cantidad_visitas: number;
  puntos_acumulados: number;
  ultima_compra: string;
};
type ResumenStock = {
  productos_stock_critico: number;
  productos_stock_bajo: number;
  productos_stock_ok: number;
  valor_total_inventario: number;
};
type Metricas = {
  ventas_hoy: number;
  ventas_mes: number;
  productos_bajo_stock: number;
  total_clientes: number;
  ticket_promedio: number;
};

export default function Analytics() {
  // Estados
  const [filtroActivo, setFiltroActivo] = useState(2); // 30 días por defecto
  const [ventas, setVentas] = useState<VentaAgg[]>([]);
  const [productos, setProductos] = useState<ProductoTop[]>([]);
  const [productosStock, setProductosStock] = useState<BajoStock[]>([]);
  const [clientes, setClientes] = useState<ClienteFrecuente[]>([]);
  const [categorias, setCategorias] = useState<CategoriaAgg[]>([]);
  const [resumenStock, setResumenStock] = useState<ResumenStock | null>(null);
  const [metricas, setMetricas] = useState<Metricas>({
    ventas_hoy: 0,
    ventas_mes: 0,
    productos_bajo_stock: 0,
    total_clientes: 0,
    ticket_promedio: 0,
  });
  const [loading, setLoading] = useState(true);

  // Cargar datos según el filtro seleccionado
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

      setVentas((ventasRes.data as VentaAgg[]) || []);
      setProductos((productosRes.data as ProductoTop[]) || []);
      setProductosStock((productosStockRes.data as BajoStock[]) || []);
      setClientes((clientesRes.data as ClienteFrecuente[]) || []);
      setCategorias((categoriasRes.data as CategoriaAgg[]) || []);
      setResumenStock(((resumenStockRes.data || [])[0] as ResumenStock) || null);

      if (metricasRes.data && metricasRes.data.length > 0) {
        setMetricas(metricasRes.data[0] as Metricas);
      }
    } catch (error) {
      console.error("❌ Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Recargar cuando cambia el filtro
  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroActivo]);

  const predecirVentas = () => {
    if (ventas.length < 7) return 0;
    const ultimos7 = ventas.slice(-7);
    return ultimos7.reduce((sum, v) => sum + Number(v.total), 0) / 7;
  };

  const getTendencia = () => {
    if (ventas.length < 14) return { texto: "estable", emoji: "➡️", color: "gray", porcentaje: 0 };

    const mitad = Math.floor(ventas.length / 2);
    const primera = ventas.slice(0, mitad);
    const segunda = ventas.slice(mitad);

    const promPrimera = primera.reduce((s, v) => s + Number(v.total), 0) / primera.length;
    const promSegunda = segunda.reduce((s, v) => s + Number(v.total), 0) / segunda.length;

    const cambio = promPrimera === 0 ? 0 : ((promSegunda - promPrimera) / promPrimera) * 100;

    if (cambio > 5) return { texto: "subida", emoji: "📈", color: "green", porcentaje: cambio };
    if (cambio < -5) return { texto: "bajada", emoji: "📉", color: "red", porcentaje: cambio };
    return { texto: "estable", emoji: "➡️", color: "gray", porcentaje: cambio };
  };

  const formatMoney = (valor: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(valor || 0);

  const formatDate = (fecha: string) =>
    new Date(fecha).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const ventasChart = ventas.map((v) => ({
    fecha: new Date(v.fecha).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    }),
    ventas: Number(v.total),
  }));

  const productosChart = productos.slice(0, 10).map((p) => ({
    nombre: p.nombre.length > 12 ? p.nombre.substring(0, 12) + "..." : p.nombre,
    nombreCompleto: p.nombre,
    cantidad: Number(p.cantidad_vendida),
  }));

  const categoriasChart = categorias.map((c) => ({
    name: c.categoria,
    value: Number(c.total_ventas),
    porcentaje: Number(c.porcentaje),
  }));

  const tendencia = getTendencia();

  const CustomTooltipAnillo = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{payload[0].name}</p>
          <p className="text-green-600 font-bold">{formatMoney(payload[0].value)}</p>
          <p className="text-gray-600 text-sm">
            {payload[0].payload.porcentaje.toFixed(1)}% del total
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-semibold">Cargando analytics...</p>
          <p className="text-gray-400 text-sm mt-2">
            Aplicando filtro: {FILTROS_TIEMPO[filtroActivo].label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Encabezado con Filtros */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              📊 Dashboard Analytics
            </h1>
            <p className="text-gray-600 mt-2">Vista completa de tu negocio en tiempo real</p>
          </div>

          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" />
            Actualizar
          </button>
        </div>

        {/* FILTROS DE TIEMPO */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FilterIcon className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Filtrar por período:</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {FILTROS_TIEMPO.map((filtro, index) => (
              <button
                key={index}
                onClick={() => setFiltroActivo(index)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                  filtroActivo === index
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Calendar className="w-5 h-5 mx-auto mb-1" />
                {filtro.label}
              </button>
            ))}
          </div>

          <p className="text-sm text-gray-500 mt-4">
            📅 Mostrando datos de:{" "}
            <span className="font-semibold text-blue-600">
              {FILTROS_TIEMPO[filtroActivo].label}
            </span>
          </p>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-12 h-12" />
            <ShoppingCart className="w-8 h-8 opacity-80" />
          </div>
          <h3 className="text-4xl font-bold mb-2">{formatMoney(metricas.ventas_hoy)}</h3>
          <p className="text-sm opacity-90">Ventas de Hoy</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-12 h-12" />
            <Calendar className="w-8 h-8 opacity-80" />
          </div>
          <h3 className="text-4xl font-bold mb-2">{formatMoney(metricas.ventas_mes)}</h3>
          <p className="text-sm opacity-90">Ventas del Mes</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-12 h-12" />
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <h3 className="text-4xl font-bold mb-2">{formatMoney(metricas.ticket_promedio)}</h3>
          <p className="text-sm opacity-90">Ticket Promedio</p>
        </div>

        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-12 h-12" />
            <Users className="w-8 h-8 opacity-80" />
          </div>
          <h3 className="text-4xl font-bold mb-2">{metricas.total_clientes}</h3>
          <p className="text-sm opacity-90">Total Clientes</p>
        </div>
      </div>

      {/* Alerta de Stock */}
      {metricas.productos_bajo_stock > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-lg mb-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-orange-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-orange-900 text-lg mb-2">⚠️ Alerta de Inventario</h3>
              <p className="text-orange-800">
                Tienes{" "}
                <span className="font-bold text-xl">{metricas.productos_bajo_stock}</span> productos
                con stock bajo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Predicción y Tendencia */}
      {ventas.length >= 7 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500 p-6 rounded-lg shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-purple-500 p-3 rounded-lg">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-purple-900 text-xl mb-3">🤖 Predicción IA</h3>
                <p className="text-purple-800 mb-2">Estimado para mañana:</p>
                <p className="text-4xl font-bold text-purple-600 mb-2">
                  {formatMoney(predecirVentas())}
                </p>
                <p className="text-sm text-purple-700">Basado en últimos 7 días</p>
              </div>
            </div>
          </div>

          <div
            className={`bg-gradient-to-br ${
              tendencia.color === "green"
                ? "from-green-50 to-green-100 border-green-500"
                : tendencia.color === "red"
                ? "from-red-50 to-red-100 border-red-500"
                : "from-gray-50 to-gray-100 border-gray-500"
            } border-l-4 p-6 rounded-lg shadow-sm`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`${
                  tendencia.color === "green"
                    ? "bg-green-500"
                    : tendencia.color === "red"
                    ? "bg-red-500"
                    : "bg-gray-500"
                } p-3 rounded-lg`}
              >
                <span className="text-4xl">{tendencia.emoji}</span>
              </div>
              <div className="flex-1">
                <h3
                  className={`font-bold text-xl mb-3 ${
                    tendencia.color === "green"
                      ? "text-green-900"
                      : tendencia.color === "red"
                      ? "text-red-900"
                      : "text-gray-900"
                  }`}
                >
                  Tendencia: {tendencia.texto.toUpperCase()}
                </h3>
                <p className="text-3xl font-bold mb-2">
                  {tendencia.porcentaje > 0 ? "+" : ""}
                  {tendencia.porcentaje.toFixed(1)}%
                </p>
                <p
                  className={`text-sm ${
                    tendencia.color === "green"
                      ? "text-green-800"
                      : tendencia.color === "red"
                      ? "text-red-800"
                      : "text-gray-800"
                  }`}
                >
                  {tendencia.color === "green" && "¡Excelente! Ventas en crecimiento 🎉"}
                  {tendencia.color === "red" && "Considera promociones"}
                  {tendencia.color === "gray" && "Ventas estables"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRÁFICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Ventas */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            📈 Evolución de Ventas
            <span className="text-sm text-gray-500 font-normal">({FILTROS_TIEMPO[filtroActivo].label})</span>
          </h2>
          {ventasChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={ventasChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="fecha" style={{ fontSize: "12px" }} stroke="#6b7280" />
                <YAxis
                  style={{ fontSize: "12px" }}
                  stroke="#6b7280"
                  tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(1)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatMoney(Number(value))}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "2px solid #3b82f6",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ventas"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: "#3b82f6", r: 5 }}
                  activeDot={{ r: 8 }}
                  name="Ventas"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-400">
              <p>No hay datos para este período</p>
            </div>
          )}
        </div>

        {/* Anillo de Categorías */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🎯 Por Categoría</h2>
          {categoriasChart.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoriasChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {categoriasChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltipAnillo />} />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {categoriasChart.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700 font-medium">{cat.name}</span>
                    </div>
                    <span className="text-gray-600 font-semibold">
                      {cat.porcentaje.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              <p>No hay datos</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Productos */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">🏆 Top 10 Productos Más Vendidos</h2>
        {productosChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={productosChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="nombre"
                angle={-45}
                textAnchor="end"
                height={100}
                style={{ fontSize: "11px" }}
                stroke="#6b7280"
              />
              <YAxis style={{ fontSize: "12px" }} stroke="#6b7280" />
              <Tooltip
                formatter={(value: number, _name: string, props: any) => [
                  `${value} unidades`,
                  props.payload.nombreCompleto,
                ]}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "2px solid #10b981",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="cantidad" fill="#10b981" radius={[8, 8, 0, 0]} name="Unidades Vendidas" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-400">
            <p>No hay productos para mostrar</p>
          </div>
        )}
      </div>

      {/* Productos Bajo Stock */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-8 h-8 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900">📦 Productos Bajo Stock</h2>
          {productosStock.length > 0 && (
            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              {productosStock.length}
            </span>
          )}
        </div>

        {resumenStock && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
              <p className="text-red-900 font-bold text-2xl">
                {resumenStock.productos_stock_critico}
              </p>
              <p className="text-red-700 text-sm">Crítico (&lt;5)</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
              <p className="text-orange-900 font-bold text-2xl">
                {resumenStock.productos_stock_bajo}
              </p>
              <p className="text-orange-700 text-sm">Bajo (5-20)</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
              <p className="text-green-900 font-bold text-2xl">
                {resumenStock.productos_stock_ok}
              </p>
              <p className="text-green-700 text-sm">OK (&gt;20)</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <p className="text-blue-900 font-bold text-lg">
                {formatMoney(resumenStock.valor_total_inventario)}
              </p>
              <p className="text-blue-700 text-sm">Valor Total</p>
            </div>
          </div>
        )}

        {productosStock.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Estado</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Producto</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Categoría</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Stock</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Precio</th>
                </tr>
              </thead>
              <tbody>
                {productosStock.map((producto, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-orange-50">
                    <td className="py-4 px-4">
                      {producto.stock < 5 ? (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                          CRÍTICO
                        </span>
                      ) : (
                        <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                          BAJO
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-semibold text-gray-900">{producto.nombre}</td>
                    <td className="py-4 px-4 text-gray-600">{producto.categoria}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-lg font-bold ${
                          producto.stock < 5 ? "text-red-600" : "text-orange-600"
                        }`}
                      >
                        {producto.stock}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-700 font-medium">
                      {formatMoney(Number(producto.precio_venta))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-green-50 rounded-lg">
            <Package className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-green-800 font-semibold text-lg">
              ✅ Todos los productos tienen stock suficiente
            </p>
          </div>
        )}
      </div>

      {/* Clientes Frecuentes */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">👥 Clientes Frecuentes</h2>
        </div>

        {clientes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Pos</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Cliente</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Total</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Visitas</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Puntos</th>
                  <th className="text-left py-4 px-4 font-bold text-gray-700">Última Compra</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-blue-50">
                    <td className="py-4 px-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg ${
                          index === 0
                            ? "bg-yellow-500"
                            : index === 1
                            ? "bg-gray-400"
                            : index === 2
                            ? "bg-orange-600"
                            : "bg-blue-500"
                        }`}
                      >
                        {index === 0 && "🥇"}
                        {index === 1 && "🥈"}
                        {index === 2 && "🥉"}
                        {index > 2 && index + 1}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-bold text-gray-900 text-lg">{cliente.nombre}</td>
                    <td className="py-4 px-4 text-green-600 font-bold text-lg">
                      {formatMoney(Number(cliente.total_compras))}
                    </td>
                    <td className="py-4 px-4">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                        {cliente.cantidad_visitas} veces
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">
                        {cliente.puntos_acumulados} pts
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-600">{formatDate(cliente.ultima_compra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 font-semibold">No hay datos de clientes</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 text-center border-2 border-blue-200">
        <p className="text-gray-700 font-semibold text-lg mb-2">
          📅 Actualizado:{" "}
          <span className="text-blue-600">{new Date().toLocaleString("es-MX")}</span>
        </p>
        <p className="text-gray-600 text-sm">
          📊 Mostrando:{" "}
          <span className="font-bold text-blue-600">{FILTROS_TIEMPO[filtroActivo].label}</span>
        </p>
      </div>
    </div>
  );
}
