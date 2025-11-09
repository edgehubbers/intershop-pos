// server/lib/chatbot-ai.ts
// ===============================================
// Chatbot de analítica para retail (México) SIN luxon
// - Parsing de tiempo/filtros en ES
// - Consultas exactas con Supabase usando [from, to)
// - Contexto anti-alucinación para LLM (Anthropic)
// ===============================================

import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "./supabase";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// -----------------------------------------------
// Tipos
// -----------------------------------------------
type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: string;
}

type TimeRange = { fromISO: string; toISO: string; label: string };

type Filtros = {
  metodosPago?: string[];
  sucursalId?: number;
  clienteId?: number;
  minTotal?: number;
  maxTotal?: number;
  productoIds?: number[];
  categoriaIds?: number[];
};

type VentasRow = {
  id: number;
  fecha: string; // ISO
  total: number;
  metodo_pago: string;
  id_cliente: number | null;
  id_sucursal: number | null;
};

// Zona horaria de referencia (solo para etiquetas; límites dependen de TZ del proceso)
const ZONE = "America/Mexico_City";

// =====================================================
// Utils de texto
// =====================================================
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function parseMoneyNumber(s?: string | null) {
  if (!s) return undefined;
  const m = s.replace(/[$,]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

// =====================================================
// Fechas nativas (basadas en TZ del proceso)
// Convención: devolvemos [fromISO, toISO) (to exclusivo)
// =====================================================
function clone(d: Date) {
  return new Date(d.getTime());
}
function addDays(d: Date, n: number) {
  const x = clone(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfDayLocal(d = new Date()) {
  const x = clone(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeekLocal(d = new Date()) {
  // Lunes = inicio. getDay(): 0=Dom...6=Sáb
  const day = d.getDay(); // 0..6
  const mondayOffset = (day + 6) % 7; // Lunes=0
  return startOfDayLocal(addDays(d, -mondayOffset));
}
function startOfMonthLocal(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return x;
}
function startOfYearLocal(y = new Date().getFullYear()) {
  return new Date(y, 0, 1, 0, 0, 0, 0);
}
function toISO(d: Date) {
  return d.toISOString();
}
function ymdLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function rangeLabel(from: Date, toExclusive: Date) {
  const toInclusive = new Date(toExclusive.getTime() - 1);
  const a = ymdLocal(from);
  const b = ymdLocal(toInclusive);
  return a === b ? a : `del ${a} al ${b}`;
}

// =====================================================
// Parsing de rango temporal en español (nativo)
// Soporta:
// - "hoy", "ayer", "antier|antes de ayer"
// - "esta semana|semana pasada"
// - "este mes|mes pasado"
// - "este año|año pasado"
// - "ultimos N dias|semanas|meses"
// - "del YYYY-MM-DD al YYYY-MM-DD" | "del DD/MM/YYYY al DD/MM/YYYY"
// - Año "2024"
// Default: últimos 90 días (incluido hoy)
// =====================================================
function parseTimeRangeES(text: string, now = new Date()): TimeRange {
  const s = norm(text);

  // Rangos explícitos ISO
  const rISO = s.match(/\bdel\s+(\d{4}-\d{2}-\d{2})\s+al\s+(\d{4}-\d{2}-\d{2})\b/);
  if (rISO) {
    const from = startOfDayLocal(new Date(`${rISO[1]}T00:00:00`));
    const end = startOfDayLocal(addDays(new Date(`${rISO[2]}T00:00:00`), 1)); // exclusivo
    return { fromISO: toISO(from), toISO: toISO(end), label: rangeLabel(from, end) };
  }
  // Rangos explícitos D/M/Y
  const rDMY = s.match(/\bdel\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+al\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (rDMY) {
    const parseDMY = (x: string) => {
      const [d, m, y] = x.split("/").map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    };
    const from = startOfDayLocal(parseDMY(rDMY[1]));
    const end = startOfDayLocal(addDays(parseDMY(rDMY[2]), 1));
    return { fromISO: toISO(from), toISO: toISO(end), label: rangeLabel(from, end) };
  }

  // Palabras clave
  if (/\bhoy\b/.test(s)) {
    const from = startOfDayLocal(now);
    const end = addDays(from, 1);
    return { fromISO: toISO(from), toISO: toISO(end), label: "hoy" };
  }
  if (/\bayer\b/.test(s)) {
    const y = addDays(now, -1);
    const from = startOfDayLocal(y);
    const end = addDays(from, 1);
    return { fromISO: toISO(from), toISO: toISO(end), label: "ayer" };
  }
  if (/\bantier\b|\bantes de ayer\b/.test(s)) {
    const y = addDays(now, -2);
    const from = startOfDayLocal(y);
    const end = addDays(from, 1);
    return { fromISO: toISO(from), toISO: toISO(end), label: "antier" };
  }

  if (/\best(a|e)\s+semana\b/.test(s)) {
    const from = startOfWeekLocal(now);
    const end = addDays(from, 7);
    return { fromISO: toISO(from), toISO: toISO(end), label: "esta semana" };
  }
  if (/\bsemana\s+pasada\b/.test(s)) {
    const last = addDays(now, -7);
    const from = startOfWeekLocal(last);
    const end = addDays(from, 7);
    return { fromISO: toISO(from), toISO: toISO(end), label: "semana pasada" };
  }

  if (/\best(e|a)\s+mes\b/.test(s)) {
    const from = startOfMonthLocal(now);
    const end = startOfMonthLocal(addDays(new Date(now.getFullYear(), now.getMonth(), 28), 4)); // siguiente mes día 1
    return { fromISO: toISO(from), toISO: toISO(end), label: "este mes" };
  }
  if (/\bmes\s+pasado\b/.test(s)) {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const from = startOfMonthLocal(last);
    const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { fromISO: toISO(from), toISO: toISO(end), label: "mes pasado" };
  }

  if (/\best(e|a)\s+ano\b|\best(e|a)\s+año\b/.test(s)) {
    const from = startOfYearLocal(now.getFullYear());
    const end = startOfYearLocal(now.getFullYear() + 1);
    return { fromISO: toISO(from), toISO: toISO(end), label: "este año" };
  }
  if (/\bano\s+pasado\b|\baño\s+pasado\b/.test(s)) {
    const y = now.getFullYear() - 1;
    const from = startOfYearLocal(y);
    const end = startOfYearLocal(y + 1);
    return { fromISO: toISO(from), toISO: toISO(end), label: "año pasado" };
  }

  // Últimos X días/semanas/meses
  const ult = s.match(/\bultimos?\s+(\d{1,3})\s+(dias?|semanas?|meses?)\b/);
  if (ult) {
    const n = Math.max(1, Math.min(365, Number(ult[1])));
    const unit = ult[2].startsWith("dia") ? "d" : ult[2].startsWith("semana") ? "w" : "m";
    const todayStart = startOfDayLocal(now);
    let from: Date;
    if (unit === "d") {
      from = addDays(todayStart, -(n - 1));
    } else if (unit === "w") {
      from = addDays(todayStart, -7 * n + 1);
    } else {
      // meses: del mismo día hace n-1 meses aprox al final de hoy
      const base = new Date(todayStart.getFullYear(), todayStart.getMonth() - (n - 1), todayStart.getDate());
      from = startOfDayLocal(base);
    }
    const end = addDays(todayStart, 1);
    return { fromISO: toISO(from), toISO: toISO(end), label: `últimos ${n} ${ult[2]}` };
  }

  // Año explícito 20xx
  const year = s.match(/\b(20\d{2})\b/);
  if (year) {
    const y = Number(year[1]);
    const from = startOfYearLocal(y);
    const end = startOfYearLocal(y + 1);
    return { fromISO: toISO(from), toISO: toISO(end), label: String(y) };
  }

  // Por defecto: últimos 90 días (incluye hoy)
  const todayStart = startOfDayLocal(now);
  const from = addDays(todayStart, -89);
  const end = addDays(todayStart, 1);
  return { fromISO: toISO(from), toISO: toISO(end), label: "últimos 90 días" };
}

// =====================================================
// Parsing de filtros en español
// =====================================================
function parseFiltrosES(text: string): Filtros {
  const s = norm(text);
  const filtros: Filtros = {};

  // método(s) de pago
  const mPago =
    s.match(/\bmetodo\s*:\s*([a-z0-9 ,.-]+)\b/) ||
    s.match(/\bpago\s+(efectivo|tarjeta|transferencia|vales|cheque)\b/);
  if (mPago) {
    const raw = (mPago[1] ?? mPago[0]).replace("metodo:", "").replace("pago", "");
    const methods = raw
      .split(/[ ,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (methods.length) filtros.metodosPago = uniq(methods);
  }

  // sucursal/cliente
  const suc = s.match(/\bsucursal\s+(\d+)\b/);
  if (suc) filtros.sucursalId = Number(suc[1]);
  const cli = s.match(/\bcliente\s+(\d+)\b/);
  if (cli) filtros.clienteId = Number(cli[1]);

  // totales
  const entre = s.match(/\bentre\s+\$?([0-9.,]+)\s+y\s+\$?([0-9.,]+)\b/);
  if (entre) {
    filtros.minTotal = parseMoneyNumber(entre[1]);
    filtros.maxTotal = parseMoneyNumber(entre[2]);
  } else {
    const min = s.match(/\b(mayor|>=?)\s+a\s+\$?([0-9.,]+)\b/);
    if (min) filtros.minTotal = parseMoneyNumber(min[2]);
    const max = s.match(/\b(menor|<=?)\s+a\s+\$?([0-9.,]+)\b/);
    if (max) filtros.maxTotal = parseMoneyNumber(max[2]);
  }

  // productos/categorías por id
  const prod = s.match(/\bproducto[s]?\s+([\d, ]+)\b/);
  if (prod) filtros.productoIds = uniq(prod[1].split(/[ ,]+/).map((x) => Number(x)).filter(Boolean));

  const cat = s.match(/\bcategoria[s]?\s+([\d, ]+)\b/);
  if (cat) filtros.categoriaIds = uniq(cat[1].split(/[ ,]+/).map((x) => Number(x)).filter(Boolean));

  return filtros;
}

// =====================================================
// Supabase
// =====================================================
async function fetchVentasInRange(fromISO: string, toISO: string, filtros: Filtros) {
  const supabase = getSupabaseServer();

  let q = supabase
    .from("ventas")
    .select("id, fecha, total, metodo_pago, id_cliente, id_sucursal")
    .gte("fecha", fromISO)
    .lt("fecha", toISO); // to exclusivo

  if (filtros.metodosPago?.length) q = q.in("metodo_pago", filtros.metodosPago);
  if (typeof filtros.sucursalId === "number") q = q.eq("id_sucursal", filtros.sucursalId);
  if (typeof filtros.clienteId === "number") q = q.eq("id_cliente", filtros.clienteId);
  if (typeof filtros.minTotal === "number") q = q.gte("total", filtros.minTotal);
  if (typeof filtros.maxTotal === "number") q = q.lte("total", filtros.maxTotal);

  const { data, error } = await q.order("fecha", { ascending: true });
  if (error) throw error;

  const rows: VentasRow[] = (data ?? []).map((r: any) => ({
    id: Number(r.id),
    fecha: String(r.fecha),
    total: Number(r.total),
    metodo_pago: String(r.metodo_pago),
    id_cliente: r.id_cliente !== null ? Number(r.id_cliente) : null,
    id_sucursal: r.id_sucursal !== null ? Number(r.id_sucursal) : null,
  }));

  return rows;
}

async function fetchDetallesForVentas(ventaIds: number[]) {
  const supabase = getSupabaseServer();
  if (!ventaIds.length)
    return [] as Array<{ id_venta: number; id_producto: number; cantidad: number; precio_unitario: number; subtotal: number }>;

  const { data, error } = await supabase
    .from("detalle_venta")
    .select("id_venta, id_producto, cantidad, precio_unitario, subtotal")
    .in("id_venta", ventaIds);

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id_venta: Number(r.id_venta),
    id_producto: Number(r.id_producto),
    cantidad: Number(r.cantidad),
    precio_unitario: Number(r.precio_unitario),
    subtotal: Number(r.subtotal),
  }));
}

async function fetchProductosMap(productIds: number[]) {
  const supabase = getSupabaseServer();
  const ids = uniq(productIds).filter(Boolean);
  if (!ids.length) return new Map<number, any>();

  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, id_categoria, precio_venta, stock")
    .in("id", ids);
  if (error) throw error;

  const map = new Map<number, any>();
  for (const p of data ?? []) {
    map.set(Number(p.id), {
      id: Number(p.id),
      nombre: String(p.nombre),
      id_categoria: p.id_categoria !== null ? Number(p.id_categoria) : null,
      precio_venta: Number(p.precio_venta),
      stock: Number(p.stock),
    });
  }
  return map;
}

async function fetchCategoriasMap() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("categorias").select("id, nombre");
  if (error) throw error;
  const map = new Map<number, string>();
  for (const c of data ?? []) map.set(Number(c.id), String(c.nombre));
  return map;
}

async function fetchLowStock(threshold = 10) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, stock, precio_venta, id_categoria")
    .lte("stock", threshold)
    .order("stock", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: Number(r.id),
    nombre: String(r.nombre),
    stock: Number(r.stock),
    precio_venta: Number(r.precio_venta),
    id_categoria: r.id_categoria !== null ? Number(r.id_categoria) : null,
  }));
}

// =====================================================
// Agregaciones
// =====================================================
function groupPorDiaLocal(rows: VentasRow[]) {
  const map = new Map<string, { fecha: string; ventas: number; monto: number }>();
  for (const r of rows) {
    const d = new Date(r.fecha);
    const key = ymdLocal(d); // día en zona local del proceso
    const prev = map.get(key) ?? { fecha: key, ventas: 0, monto: 0 };
    prev.ventas += 1;
    prev.monto += r.total;
    map.set(key, prev);
  }
  return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function aggregateMetodos(rows: VentasRow[]) {
  const map = new Map<string, { metodo: string; total: number; cantidad: number }>();
  for (const r of rows) {
    const k = r.metodo_pago || "desconocido";
    const prev = map.get(k) ?? { metodo: k, total: 0, cantidad: 0 };
    prev.total += r.total;
    prev.cantidad += 1;
    map.set(k, prev);
  }
  return Array.from(map.values());
}

function aggregateTopProductos(
  detalles: any[],
  productosMap: Map<number, any>,
  topN = 10
) {
  const agg = new Map<
    number,
    { id_producto: number; unidades: number; ingreso: number; nombre: string; stock: number; id_categoria: number | null }
  >();
  for (const d of detalles) {
    const p = productosMap.get(d.id_producto);
    if (!p) continue;
    const prev =
      agg.get(d.id_producto) ??
      {
        id_producto: d.id_producto,
        unidades: 0,
        ingreso: 0,
        nombre: p.nombre,
        stock: p.stock,
        id_categoria: p.id_categoria,
      };
    prev.unidades += d.cantidad;
    prev.ingreso += d.subtotal;
    agg.set(d.id_producto, prev);
  }
  return Array.from(agg.values())
    .sort((a, b) => b.unidades - a.unidades || b.ingreso - a.ingreso)
    .slice(0, topN);
}

function aggregateCategorias(detalles: any[], productosMap: Map<number, any>, categoriasMap: Map<number, string>) {
  const cat = new Map<string, { categoria: string; unidades: number; ingreso: number }>();
  let totalIngreso = 0;
  for (const d of detalles) {
    const p = productosMap.get(d.id_producto);
    if (!p) continue;
    const nombre = p.id_categoria ? categoriasMap.get(p.id_categoria) ?? "Sin categoría" : "Sin categoría";
    const prev = cat.get(nombre) ?? { categoria: nombre, unidades: 0, ingreso: 0 };
    prev.unidades += d.cantidad;
    prev.ingreso += d.subtotal;
    totalIngreso += d.subtotal;
    cat.set(nombre, prev);
  }
  const arr = Array.from(cat.values());
  return arr
    .map((c) => ({
      ...c,
      porcentaje: totalIngreso ? Number(((c.ingreso / totalIngreso) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.ingreso - a.ingreso);
}

function filtrarPorProductoCategoria(
  ventas: VentasRow[],
  detalles: { id_venta: number; id_producto: number; cantidad: number; precio_unitario: number; subtotal: number }[],
  filtros: Filtros,
  productosMap: Map<number, any>
) {
  if ((!filtros.productoIds || filtros.productoIds.length === 0) && (!filtros.categoriaIds || filtros.categoriaIds.length === 0)) {
    return { ventasFiltradas: ventas, detallesFiltrados: detalles };
  }

  let detalleCandidate = detalles;

  if (filtros.productoIds?.length) {
    const setProd = new Set(filtros.productoIds);
    detalleCandidate = detalleCandidate.filter((d) => setProd.has(d.id_producto));
  }

  if (filtros.categoriaIds?.length) {
    const setCat = new Set(filtros.categoriaIds);
    detalleCandidate = detalleCandidate.filter((d) => {
      const p = productosMap.get(d.id_producto);
      return p && p.id_categoria && setCat.has(p.id_categoria);
    });
  }

  const ventaIdsOK = new Set(detalleCandidate.map((d) => d.id_venta));
  const ventasFiltradas = ventas.filter((v) => ventaIdsOK.has(v.id));
  const detallesFiltrados = detalles.filter((d) => ventaIdsOK.has(d.id_venta));

  return { ventasFiltradas, detallesFiltrados };
}

// =====================================================
// Recomendaciones
// =====================================================
function buildBusinessTips(payload: {
  ventas: {
    porDia: Array<{ fecha: string; ventas: number; monto: number }>;
    ticket_promedio: number;
  };
  topProductos: ReturnType<typeof aggregateTopProductos>;
  categorias: ReturnType<typeof aggregateCategorias>;
  lowStock: Awaited<ReturnType<typeof fetchLowStock>>;
}) {
  const tips: string[] = [];
  const { ventas, topProductos, categorias, lowStock } = payload;

  // Tendencia simple 1/3 vs 1/3
  if (ventas.porDia.length >= 6) {
    const t = ventas.porDia;
    const seg = Math.floor(t.length / 3);
    const a = t.slice(0, seg);
    const b = t.slice(-seg);
    const avgA = a.reduce((s, x) => s + x.monto, 0) / a.length || 0;
    const avgB = b.reduce((s, x) => s + x.monto, 0) / b.length || 0;
    const pct = avgA === 0 ? 0 : ((avgB - avgA) / avgA) * 100;
    if (pct <= -10)
      tips.push(
        `Las ventas muestran una **baja de ${pct.toFixed(1)}%** al cierre del periodo. Considera: 1) descuentos por volumen, 2) bundles, 3) campañas a clientes frecuentes.`
      );
    else if (pct >= 10)
      tips.push(`Las ventas crecen **${pct.toFixed(1)}%**. Mantén surtido de los top productos y evalúa aumentar ligeramente el margen.`);
  }

  // Concentración de categorías
  if (categorias.length > 0 && categorias[0].porcentaje >= 40) {
    tips.push(`Alta concentración en **${categorias[0].categoria} (${categorias[0].porcentaje}%)**. Diversifica promociones hacia otras categorías.`);
  }

  // Stock crítico
  if (lowStock.length > 0) {
    const criticos = lowStock.filter((p) => p.stock < 5).length;
    const bajos = lowStock.filter((p) => p.stock >= 5 && p.stock <= 10).length;
    tips.push(`Inventario: **${criticos} críticos** y **${bajos} bajos**. Reabastece priorizando críticos y top-venta.`);
  }

  // Top producto
  if (topProductos.length) {
    const tp = topProductos[0];
    tips.push(`Top producto: **${tp.nombre}**. Asegura stock (actual: ${tp.stock}) y considera cross-sell con complementarios.`);
  }

  // Ticket promedio
  if (ventas.ticket_promedio > 0) {
    tips.push(`Ticket promedio: **$${ventas.ticket_promedio.toFixed(2)}**. Prueba: precios escalonados y displays cercanos a caja.`);
  }

  return tips;
}

// =====================================================
// Clase principal
// =====================================================
export class ChatbotWithAI {
  async processMessage(message: string, history: Message[] = []): Promise<string> {
    try {
      // 1) Rango temporal + filtros
      const range = parseTimeRangeES(message, new Date());
      const filtros = parseFiltrosES(message);

      // 2) Ventas en rango (filtros simples)
      const ventasRows = await fetchVentasInRange(range.fromISO, range.toISO, filtros);
      const ventaIds = ventasRows.map((v) => v.id);

      // 3) Detalles de esas ventas
      const detalles = await fetchDetallesForVentas(ventaIds);

      // 4) Productos/categorías para agregaciones y filtros a nivel detalle
      const productosMap = await fetchProductosMap(uniq(detalles.map((d) => d.id_producto)));
      const categoriasMap = await fetchCategoriasMap();

      // 5) Filtro a nivel detalle por producto/categoría (preciso)
      const { ventasFiltradas, detallesFiltrados } = filtrarPorProductoCategoria(
        ventasRows,
        detalles,
        filtros,
        productosMap
      );

      // 6) Agregaciones
      const total = ventasFiltradas.reduce((a, b) => a + (Number.isFinite(b.total) ? b.total : 0), 0);
      const count = ventasFiltradas.length;
      const ticketProm = count ? total / count : 0;

      const porDia = groupPorDiaLocal(ventasFiltradas);
      const metodos = aggregateMetodos(ventasFiltradas);
      const topProductos = aggregateTopProductos(detallesFiltrados, productosMap, 10);
      const categorias = aggregateCategorias(detallesFiltrados, productosMap, categoriasMap);
      const lowStock = await fetchLowStock(10);

      const tips = buildBusinessTips({
        ventas: { porDia, ticket_promedio: ticketProm },
        topProductos,
        categorias,
        lowStock,
      });

      // 7) Contexto para el LLM
      const context = {
        periodo: range.label,
        rango: { fromISO: range.fromISO, toISO: range.toISO, zona: ZONE, conv: "[from, to)" },
        filtrosAplicados: filtros,
        resumenVentas: {
          total: Number(total.toFixed(2)),
          cantidadVentas: count,
          ticketPromedio: Number(ticketProm.toFixed(2)),
          metodosPago: metodos,
        },
        ventasPorDia: porDia,
        topProductos,
        categorias,
        clientesFrecuentes: (function () {
          const map = new Map<number, { id_cliente: number; compras: number; total: number }>();
          for (const v of ventasFiltradas) {
            if (!v.id_cliente) continue;
            const prev = map.get(v.id_cliente) ?? { id_cliente: v.id_cliente, compras: 0, total: 0 };
            prev.compras += 1;
            prev.total += v.total;
            map.set(v.id_cliente, prev);
          }
          return Array.from(map.values())
            .sort((a, b) => b.compras - a.compras || b.total - a.total)
            .slice(0, 10);
        })(),
        stockBajo: lowStock,
        tips,
      };

      // 8) Historia (últimos 5)
      const cleanHistory = history.slice(-5).map((m) => ({ role: m.role as Role, content: m.content }));

      // 9) Prompt anti-alucinación
      const systemPrompt = `
Eres un analista de retail en México (zona horaria ${ZONE}).
Tu respuesta DEBE basarse EXCLUSIVAMENTE en el JSON "DATOS" que te doy.
NUNCA inventes números, categorías, clientes o productos que no estén en DATOS.
Si un dato no está, responde exactamente: "No tengo ese dato para el período consultado".
Puedes hacer cálculos simples (porcentajes / diferencias) SOLO con números presentes en DATOS.
Formatea con markdown y emojis cuando sea útil.

POLÍTICAS:
- Cita el periodo leído (p. ej., "últimos 30 días") y las fechas exactas.
- Si te piden un periodo distinto al de DATOS, primero explica qué periodo estás usando.
- Si piden comparación con otro periodo y no existe en DATOS, indícalo sin inventar.
- Si se aplicaron filtros, menciónalos (métodos, sucursal, cliente, producto/categoría, totales).

ENTREGA:
- Resumen breve del periodo.
- 3–6 bullets con hallazgos clave (ventas, ticket, top productos, categorías).
- Si "tips" incluye elementos, añade "Recomendaciones" (1–4 bullets).
- Si piden una lista (p. ej. top productos), lista ordenada y con valores exactos de DATOS.

DATOS:
${JSON.stringify(context, null, 2)}
`.trim();

      // 10) Llamada a Claude
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [...cleanHistory, { role: "user", content: message }],
      });

      const first = response.content[0];
      if (first?.type === "text") return first.text;
      throw new Error("Respuesta inesperada de Claude");
    } catch (error: any) {
      console.error("❌ Error en processMessage:", error?.message ?? error);
      if (error?.response?.data) console.error("Claude data:", error.response.data);
      return "Lo siento, hubo un error al procesar tu solicitud.";
    }
  }
}
