import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseServer } from "./supabase";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: string;
}

type TimeRange = { fromISO: string; toISO: string; label: string };

// ------------ Utilidades de tiempo (ES) ------------
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(y = new Date().getFullYear()) {
  return new Date(y, 0, 1, 0, 0, 0, 0);
}
function endOfYear(y = new Date().getFullYear()) {
  return new Date(y, 11, 31, 23, 59, 59, 999);
}

// Detecta rango temporal en español a partir del texto del usuario
function parseTimeRangeES(text: string): TimeRange {
  const s = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const now = new Date();

  // hoy / ayer
  if (/\bhoy\b/.test(s)) {
    return { fromISO: startOfDay(now).toISOString(), toISO: endOfDay(now).toISOString(), label: "hoy" };
  }
  if (/\bayer\b|\bay er\b|\bayer\b/.test(s) || /\bayer\b/.test(s) /* robustez */ || /\bayer\b/.test(s)) {
    const y = addDays(startOfDay(now), -1);
    return { fromISO: startOfDay(y).toISOString(), toISO: endOfDay(y).toISOString(), label: "ayer" };
  }
  if (/\bayer\b/.test(s)) {
    const y = addDays(startOfDay(now), -1);
    return { fromISO: startOfDay(y).toISOString(), toISO: endOfDay(y).toISOString(), label: "ayer" };
  }
  if (/\bayer\b/.test(s)) {
    const y = addDays(startOfDay(now), -1);
    return { fromISO: startOfDay(y).toISOString(), toISO: endOfDay(y).toISOString(), label: "ayer" };
  }

  // últimos X días
  const ultimosMatch = s.match(/ultimos?\s+(\d{1,3})\s+dias?/);
  if (ultimosMatch) {
    const n = Math.min(365, Math.max(1, parseInt(ultimosMatch[1], 10)));
    const from = addDays(startOfDay(now), -n + 1);
    return { fromISO: from.toISOString(), toISO: endOfDay(now).toISOString(), label: `últimos ${n} días` };
  }

  // este mes / mes pasado
  if (/\beste\s+mes\b/.test(s)) {
    return { fromISO: startOfMonth(now).toISOString(), toISO: endOfMonth(now).toISOString(), label: "este mes" };
  }
  if (/\bmes\s+pasado\b/.test(s)) {
    const m = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { fromISO: startOfMonth(m).toISOString(), toISO: endOfMonth(m).toISOString(), label: "mes pasado" };
  }

  // este año / año pasado
  if (/\beste\s+ano\b|\beste\s+año\b/.test(s)) {
    const y = now.getFullYear();
    return { fromISO: startOfYear(y).toISOString(), toISO: endOfYear(y).toISOString(), label: "este año" };
  }
  if (/\bano\s+pasado\b|\baño\s+pasado\b/.test(s)) {
    const y = now.getFullYear() - 1;
    return { fromISO: startOfYear(y).toISOString(), toISO: endOfYear(y).toISOString(), label: "año pasado" };
  }

  // un año explícito (2023/2024/2025…)
  const yearMatch = s.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    return { fromISO: startOfYear(y).toISOString(), toISO: endOfYear(y).toISOString(), label: String(y) };
  }

  // Por defecto: últimos 90 días
  const from = addDays(startOfDay(now), -89);
  return { fromISO: from.toISOString(), toISO: endOfDay(now).toISOString(), label: "últimos 90 días" };
}

// ------------- Lectura de datos en Supabase -------------
async function fetchVentasInRange(fromISO: string, toISO: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("ventas")
    .select("id, fecha, total, metodo_pago, id_cliente")
    .gte("fecha", fromISO)
    .lte("fecha", toISO)
    .order("fecha", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []).map((r: any) => ({
    id: Number(r.id),
    fecha: r.fecha,
    total: Number(r.total),
    metodo_pago: r.metodo_pago as string,
    id_cliente: r.id_cliente ? Number(r.id_cliente) : null,
  }));

  // Totales
  const total = rows.reduce((a, b) => a + (Number.isFinite(b.total) ? b.total : 0), 0);
  const ticketProm = rows.length ? total / rows.length : 0;

  // Por día
  const byDateMap = new Map<string, { fecha: string; ventas: number; monto: number }>();
  for (const r of rows) {
    const day = new Date(r.fecha).toISOString().slice(0, 10);
    const prev = byDateMap.get(day) ?? { fecha: day, ventas: 0, monto: 0 };
    prev.ventas += 1;
    prev.monto += r.total;
    byDateMap.set(day, prev);
  }
  const porDia = Array.from(byDateMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Métodos de pago
  const payMap = new Map<string, { metodo: string; total: number; cantidad: number }>();
  for (const r of rows) {
    const k = r.metodo_pago || "desconocido";
    const prev = payMap.get(k) ?? { metodo: k, total: 0, cantidad: 0 };
    prev.total += r.total;
    prev.cantidad += 1;
    payMap.set(k, prev);
  }
  const metodos = Array.from(payMap.values());

  // Tendencia simple (último tercio vs primero)
  let tendencia = { cambioPct: 0 };
  if (porDia.length >= 6) {
    const n = porDia.length;
    const a = porDia.slice(0, Math.floor(n / 3));
    const b = porDia.slice(-Math.floor(n / 3));
    const avgA = a.reduce((s, x) => s + x.monto, 0) / a.length;
    const avgB = b.reduce((s, x) => s + x.monto, 0) / b.length;
    const pct = avgA === 0 ? 0 : ((avgB - avgA) / avgA) * 100;
    tendencia = { cambioPct: Number(pct.toFixed(1)) };
  }

  // Clientes frecuentes
  const clientMap = new Map<number, { id_cliente: number; compras: number; total: number }>();
  for (const r of rows) {
    if (!r.id_cliente) continue;
    const prev = clientMap.get(r.id_cliente) ?? { id_cliente: r.id_cliente, compras: 0, total: 0 };
    prev.compras += 1;
    prev.total += r.total;
    clientMap.set(r.id_cliente, prev);
  }
  const clientesFrecuentes = Array.from(clientMap.values())
    .sort((a, b) => b.compras - a.compras || b.total - a.total)
    .slice(0, 10);

  return {
    rows,
    total,
    ticket_promedio: ticketProm,
    porDia,
    metodos,
    clientesFrecuentes,
    count: rows.length,
  };
}

async function fetchVentaIdsInRange(fromISO: string, toISO: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("ventas")
    .select("id")
    .gte("fecha", fromISO)
    .lte("fecha", toISO);
  if (error) throw error;
  return (data ?? []).map((r: any) => Number(r.id));
}

async function fetchDetalleVentasFor(ventaIds: number[]) {
  const supabase = getSupabaseServer();
  if (!ventaIds.length) return [];

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
  if (!productIds.length) return new Map<number, any>();

  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, id_categoria, precio_venta, stock");
  if (error) throw error;

  const map = new Map<number, any>();
  for (const p of data ?? []) {
    map.set(Number(p.id), {
      id: Number(p.id),
      nombre: p.nombre as string,
      id_categoria: p.id_categoria ? Number(p.id_categoria) : null,
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
  for (const c of data ?? []) map.set(Number(c.id), c.nombre as string);
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
    nombre: r.nombre as string,
    stock: Number(r.stock),
    precio_venta: Number(r.precio_venta),
    id_categoria: r.id_categoria ? Number(r.id_categoria) : null,
  }));
}

// ------------- Agregaciones derivadas -------------
function aggregateTopProductos(detalles: any[], productosMap: Map<number, any>, topN = 10) {
  const agg = new Map<
    number,
    { id_producto: number; unidades: number; ingreso: number; nombre: string; stock: number; id_categoria: number | null }
  >();
  for (const d of detalles) {
    const p = productosMap.get(d.id_producto);
    if (!p) continue;
    const prev =
      agg.get(d.id_producto) ??
      { id_producto: d.id_producto, unidades: 0, ingreso: 0, nombre: p.nombre, stock: p.stock, id_categoria: p.id_categoria };
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
    const name = p.id_categoria ? categoriasMap.get(p.id_categoria) ?? "Sin categoría" : "Sin categoría";
    const prev = cat.get(name) ?? { categoria: name, unidades: 0, ingreso: 0 };
    prev.unidades += d.cantidad;
    prev.ingreso += d.subtotal;
    totalIngreso += d.subtotal;
    cat.set(name, prev);
  }
  const arr = Array.from(cat.values());
  return arr
    .map((c) => ({
      ...c,
      porcentaje: totalIngreso ? Number(((c.ingreso / totalIngreso) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.ingreso - a.ingreso);
}

// ------------- Reglas de recomendaciones -------------
function buildBusinessTips(payload: {
  ventas: Awaited<ReturnType<typeof fetchVentasInRange>>;
  topProductos: ReturnType<typeof aggregateTopProductos>;
  categorias: ReturnType<typeof aggregateCategorias>;
  lowStock: Awaited<ReturnType<typeof fetchLowStock>>;
}) {
  const tips: string[] = [];
  const { ventas, topProductos, categorias, lowStock } = payload;

  // Tendencia
  if (ventas.porDia.length >= 6) {
    const t = ventas.porDia;
    const first = t.slice(0, Math.floor(t.length / 3)).reduce((s, x) => s + x.monto, 0);
    const last = t.slice(-Math.floor(t.length / 3)).reduce((s, x) => s + x.monto, 0);
    const pct = first === 0 ? 0 : ((last - first) / first) * 100;
    if (pct <= -10) tips.push(`Las ventas muestran una **baja de ${pct.toFixed(1)}%** al cierre del periodo. Considera: 1) descuentos por volumen, 2) bundles, 3) campañas a clientes frecuentes.`);
    else if (pct >= 10) tips.push(`Las ventas crecen **${pct.toFixed(1)}%**. Mantén surtido de los top productos y evalúa aumentar ligeramente el margen.`);
  }

  // Concentración de categorías
  if (categorias.length > 0 && categorias[0].porcentaje >= 40) {
    tips.push(`Alta concentración en **${categorias[0].categoria} (${categorias[0].porcentaje}%)**. Reduce riesgo diversificando promociones hacia otras categorías.`);
  }

  // Stock crítico
  if (lowStock.length > 0) {
    const criticos = lowStock.filter((p) => p.stock < 5).length;
    const bajos = lowStock.filter((p) => p.stock >= 5 && p.stock <= 10).length;
    tips.push(`Inventario: **${criticos} críticos** y **${bajos} bajos**. Reabastece priorizando los críticos y los top-venta.`);
  }

  // Top producto
  if (topProductos.length) {
    const tp = topProductos[0];
    tips.push(`Top producto: **${tp.nombre}**. Asegura stock (actual: ${tp.stock}) y considera cross-sell con complementarios.`);
  }

  // Ticket promedio
  if (ventas.ticket_promedio > 0) {
    tips.push(`Ticket promedio: **$${ventas.ticket_promedio.toFixed(2)}**. Prueba: 1) precios escalonados, 2) displays cercanos a caja.`);
  }

  return tips;
}

// ------------- Clase principal -------------
export class ChatbotWithAI {
  async processMessage(message: string, history: Message[] = []): Promise<string> {
    try {
      // 1) Detecta rango temporal desde el mensaje
      const range = parseTimeRangeES(message);

      // 2) Lectura de datos (históricos incluidos)
      const ventas = await fetchVentasInRange(range.fromISO, range.toISO);
      const ventaIds = await fetchVentaIdsInRange(range.fromISO, range.toISO);
      const detalles = await fetchDetalleVentasFor(ventaIds);
      const productosMap = await fetchProductosMap([...new Set(detalles.map((d) => d.id_producto))]);
      const categoriasMap = await fetchCategoriasMap();
      const topProductos = aggregateTopProductos(detalles, productosMap, 10);
      const categorias = aggregateCategorias(detalles, productosMap, categoriasMap);
      const lowStock = await fetchLowStock(10);

      // 3) Recomendaciones algorítmicas (sin IA)
      const businessTips = buildBusinessTips({ ventas, topProductos, categorias, lowStock });

      // 4) Construye un contexto JSON (solo números/strings permitidos)
      const context = {
        periodo: range.label,
        rango: { fromISO: range.fromISO, toISO: range.toISO },
        resumenVentas: {
          total: Number(ventas.total.toFixed(2)),
          cantidadVentas: ventas.count,
          ticketPromedio: Number(ventas.ticket_promedio.toFixed(2)),
          metodosPago: ventas.metodos, // {metodo, total, cantidad}
        },
        ventasPorDia: ventas.porDia, // [{fecha, ventas, monto}]
        topProductos, // [{id_producto, nombre, unidades, ingreso, stock, id_categoria}]
        categorias, // [{categoria, unidades, ingreso, porcentaje}]
        clientesFrecuentes: ventas.clientesFrecuentes, // [{id_cliente, compras, total}]
        stockBajo: lowStock, // [{id, nombre, stock, precio_venta, id_categoria}]
        tips: businessTips,
      };

      // 5) Instrucciones anti-alucinación
      const systemPrompt = `
Eres un analista de retail en México.
Tu respuesta DEBE basarse EXCLUSIVAMENTE en el JSON "DATOS" que te doy.
NUNCA inventes números, categorías, clientes o productos que no estén en DATOS.
Si un dato no está, di: "No tengo ese dato para el período consultado".
Puedes hacer cálculos simples (porcentajes / diferencias) SOLO con números presentes en DATOS.
Formatea con markdown y emojis cuando sea útil.

POLÍTICAS:
- Cita el periodo leído (ej. "últimos 30 días", "este mes", etc.).
- Si te piden un periodo que no coincide con DATOS, primero explica qué periodo estás usando.
- Si piden comparación con otro periodo y no hay datos de ese otro periodo, indícalo sin inventar.

ENTREGA:
- Resumen breve del periodo.
- 3-6 bullets con hallazgos clave (ventas, ticket, top productos, categorías).
- Si "tips" incluye elementos, añade "Recomendaciones" (1-4 bullets).
- Si piden una lista (p.ej. top productos), lista ordenada y con valores exactos de DATOS.

DATOS:
${JSON.stringify(context, null, 2)}
`.trim();

      // 6) Historia (solo role + content), sin timestamps/ids
      const cleanHistory = history.slice(-5).map((m) => ({ role: m.role as Role, content: m.content }));

      // 7) Llamada a Claude
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
      console.error("❌ Error en processMessage:", error);
      if (error?.response?.data) console.error("Claude data:", error.response.data);
      return "Lo siento, hubo un error al procesar tu solicitud.";
    }
  }
}
