// app/routes/dashboard/sales.tsx
import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseServer } from "../../lib/supabase.server";
import { LuSearch, LuCalendar, LuFilter, LuX, LuChevronDown, LuChevronRight } from "react-icons/lu";

/* ----------------------------- Tipos ----------------------------- */
type Venta = {
  id: number;
  fecha: string | null; // ISO
  total: string | number;
  metodo_pago: string | null;
  receiver: string | null;
  payer_wallet: string | null;
};

type ItemPreview = {
  nombre: string;
  imagen_url: string | null;
};

type DetalleUI = {
  id_producto: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  imagen_url: string | null;
};

type VentaUI = Venta & {
  itemsPreview: ItemPreview[];
  itemsCount: number;
  items: DetalleUI[];
};

type LoaderData = {
  ventas: VentaUI[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  sort: "fecha" | "total";
  dir: "asc" | "desc";
  q: string;
  metodo: string;
  from: string;
  to: string;
  sumVisible: string;
  metodosDisponibles: string[];
};

/* --------------------------- Utilidades -------------------------- */
const PAGE_SIZE_DEFAULT = 10;
const BUCKET = (process.env.PRODUCTS_BUCKET || "product-images").trim();

const parsePositiveInt = (v: string | null, fb: number) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : fb;

const sanitizeSort = (v: string | null): "fecha" | "total" =>
  v === "total" ? "total" : "fecha";

const sanitizeDir = (v: string | null): "asc" | "desc" =>
  v === "asc" ? "asc" : "desc";

function addDaysISO(yyyyMMdd: string, days: number) {
  const d = new Date(`${yyyyMMdd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/* ------------------------------ Loader --------------------------- */
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), PAGE_SIZE_DEFAULT);
  const q = (url.searchParams.get("q") || "").trim();
  const metodo = (url.searchParams.get("metodo") || "").trim();
  const from = (url.searchParams.get("from") || "").trim();
  const to = (url.searchParams.get("to") || "").trim();
  const sort = sanitizeSort(url.searchParams.get("sort"));
  const dir = sanitizeDir(url.searchParams.get("dir"));

  const supabase = getSupabaseServer();

  let qb = supabase
    .from("ventas")
    .select(
      "id, fecha, total, metodo_pago, receiver, payer_wallet",
      { count: "exact", head: false }
    );

  if (q) {
    const qNum = Number(q);
    // Busca por método, id, receiver y payer_wallet
    qb = qb.or(
      Number.isFinite(qNum)
        ? `metodo_pago.ilike.%${q}%,receiver.ilike.%${q}%,payer_wallet.ilike.%${q}%,id.eq.${Math.floor(
            qNum
          )}`
        : `metodo_pago.ilike.%${q}%,receiver.ilike.%${q}%,payer_wallet.ilike.%${q}%`
    );
  }
  if (metodo) qb = qb.eq("metodo_pago", metodo);
  if (from) qb = qb.gte("fecha", new Date(`${from}T00:00:00`).toISOString());
  if (to) qb = qb.lt("fecha", addDaysISO(to, 1));

  const orderCol = sort === "total" ? "total" : "fecha";
  qb = qb
    .order(orderCol, { ascending: dir === "asc", nullsFirst: false })
    .order("id", { ascending: false, nullsFirst: false });

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  qb = qb.range(fromIdx, toIdx);

  const { data: ventas, count, error } = await qb;
  if (error) throw new Response(error.message, { status: 500 });

  // ========= Detalles por venta (intenta múltiples tablas de detalle) =========
  const ventaIds = (ventas ?? []).map((v) => v.id);
  let detalle: any[] = [];
  let detalleTable: string | null = null;

  async function tryFetchDetalle(tbl: string) {
    // normalizamos por si el schema usa venta_id o id_venta
    const { data, error: derr } = await supabase
      .from(tbl)
      .select("*")
      .in("id_venta", ventaIds)
      .order("id_venta", { ascending: false });
    if (!derr && data && data.length) return data;

    const { data: dataAlt, error: derrAlt } = await supabase
      .from(tbl)
      .select("*")
      .in("venta_id", ventaIds)
      .order("venta_id", { ascending: false });
    if (derrAlt) throw derrAlt;
    return dataAlt || [];
  }

  if (ventaIds.length) {
    // Primero la tabla real del schema: detalle_venta
    for (const tbl of ["detalle_venta", "ventas_detalle", "venta_detalle", "ventas_items"]) {
      try {
        const data = await tryFetchDetalle(tbl);
        if (data.length) {
          detalle = data;
          detalleTable = tbl;
          break;
        }
      } catch {
        // probar siguiente
      }
    }
  }

  // Obtén ids de productos para enriquecer con nombre/imagen
  let productosMap = new Map<number, { id: number; nombre: string; imagen_path: string | null }>();
  if (detalleTable && detalle.length) {
    const productoIds = new Set<number>();
    for (const row of detalle) {
      const pid =
        row.id_producto ??
        row.producto_id ??
        row.id_producto_fk ??
        row.producto ??
        null;
      if (pid && Number.isFinite(Number(pid))) productoIds.add(Number(pid));
    }

    if (productoIds.size) {
      const { data: productosData } = await supabase
        .from("productos")
        .select("id,nombre,imagen_path")
        .in("id", Array.from(productoIds));
      for (const p of productosData ?? []) {
        productosMap.set(p.id, {
          id: p.id,
          nombre: p.nombre,
          imagen_path: p.imagen_path ?? null,
        });
      }
    }
  }

  // Armar estructuras por venta
  const detallePorVenta = new Map<number, any[]>();
  for (const row of detalle) {
    const vid = Number(row.id_venta ?? row.venta_id);
    if (!detallePorVenta.has(vid)) detallePorVenta.set(vid, []);
    detallePorVenta.get(vid)!.push(row);
  }

  const withPreviews: VentaUI[] = (ventas ?? []).map((v) => {
    const rows = detallePorVenta.get(v.id) ?? [];

    // Previews (primeras 3 imágenes/nombres)
    const previews: ItemPreview[] = rows.slice(0, 3).map((r) => {
      const pid =
        r.id_producto ??
        r.producto_id ??
        r.id_producto_fk ??
        r.producto ??
        null;
      const prod = pid ? productosMap.get(Number(pid)) : undefined;
      const url = prod?.imagen_path
        ? supabase.storage.from(BUCKET).getPublicUrl(prod.imagen_path).data.publicUrl
        : null;
      return { nombre: prod?.nombre ?? "Producto", imagen_url: url };
    });

    // Detalle completo
    const items: DetalleUI[] = rows.map((r) => {
      const pid =
        r.id_producto ??
        r.producto_id ??
        r.id_producto_fk ??
        r.producto ??
        null;
      const prod = pid ? productosMap.get(Number(pid)) : undefined;
      const cantidad = Number(r.cantidad ?? r.qty ?? r.cant ?? 1);
      const precio_unitario = Number(r.precio_unitario ?? r.precio ?? r.unit_price ?? 0);
      const subtotal = Number(
        (r.subtotal ?? cantidad * precio_unitario).toFixed(2)
      );
      const imagen_url = prod?.imagen_path
        ? supabase.storage.from(BUCKET).getPublicUrl(prod.imagen_path).data.publicUrl
        : null;

      return {
        id_producto: Number(pid ?? 0),
        nombre: prod?.nombre ?? "Producto",
        cantidad,
        precio_unitario,
        subtotal,
        imagen_url,
      };
    });

    return {
      ...v,
      itemsPreview: previews,
      itemsCount: rows.length,
      items,
    };
  });

  // Métodos de pago disponibles (para filtros)
  const { data: metodosRows } = await supabase
    .from("ventas")
    .select("metodo_pago")
    .not("metodo_pago", "is", null)
    .order("metodo_pago", { ascending: true });

  const metodosDisponibles = Array.from(
    new Set((metodosRows ?? []).map((r: any) => String(r.metodo_pago).trim()).filter(Boolean))
  );

  const sumVisible = (ventas ?? []).reduce((acc, v) => acc + Number(v.total ?? 0), 0);
  const totalRows = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return {
    ventas: withPreviews,
    page,
    pageSize,
    totalRows,
    totalPages,
    sort,
    dir,
    q,
    metodo,
    from,
    to,
    sumVisible: sumVisible.toFixed(2),
    metodosDisponibles,
  } satisfies LoaderData;
}

/* ----------------------------- Componente ---------------------------- */
export default function Sales() {
  const data = useLoaderData() as LoaderData;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const [openRows, setOpenRows] = useState<Record<number, boolean>>({}); // ventas abiertas

  const isLoading = navigation.state !== "idle";

  useEffect(() => {
    const form = document.getElementById("filters-form") as HTMLFormElement | null;
    if (!form) return;
    const handler = () => submit(form, { replace: true });
    form.querySelectorAll("input, select").forEach((el) =>
      el.addEventListener("change", handler)
    );
    return () => {
      form?.querySelectorAll("input, select").forEach((el) =>
        el.removeEventListener("change", handler)
      );
    };
  }, [submit]);

  const currency = useMemo(
    () => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }),
    []
  );

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const toggleSort = (col: "fecha" | "total") => {
    const nextDir: "asc" | "desc" =
      data.sort === col ? (data.dir === "asc" ? "desc" : "asc") : "desc";
    const sp = new URLSearchParams(searchParams);
    sp.set("sort", col);
    sp.set("dir", nextDir);
    sp.set("page", "1");
    return `?${sp.toString()}`;
  };

  const pageLink = (n: number) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("page", String(n));
    return `?${sp.toString()}`;
  };

  const hasAnyFilter = Boolean(data.q || data.metodo || data.from || data.to);

  const clearParam = (param: "q" | "metodo" | "from" | "to") => {
    const sp = new URLSearchParams(searchParams);
    sp.delete(param);
    sp.set("page", "1");
    return `?${sp.toString()}`;
  };

  const resetAll = () => {
    const sp = new URLSearchParams();
    sp.set("page", "1");
    return `?${sp.toString()}`;
  };

  const toggleRow = (id: number) =>
    setOpenRows((s) => ({ ...s, [id]: !s[id] }));

  return (
    <main className="page space-y-6 md:space-y-7">
      {/* Header */}
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">Ventas</h2>
          <p className="text-sm text-gray-500">Historial, filtros y totales</p>
        </div>
      </header>

      {/* Resumen */}
      <section className="grid gap-4 md:gap-5 sm:grid-cols-3">
        <Card
          title="Total en esta página"
          value={currency.format(Number(data.sumVisible || 0))}
          hint={`${data.ventas.length} registro${data.ventas.length === 1 ? "" : "s"}`}
          loading={isLoading}
        />
        <Card
          title="Registros filtrados"
          value={String(data.totalRows)}
          hint={`${data.pageSize} por página`}
          loading={isLoading}
        />
        <Card
          title="Página"
          value={`${data.page} / ${data.totalPages}`}
          hint={data.dir === "asc" ? "Orden ascendente" : "Orden descendente"}
          loading={isLoading}
        />
      </section>

      {/* Filtros */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-gray-700">
          <LuFilter className="h-4 w-4" />
          <span className="text-sm font-medium">Filtros</span>
        </div>

        <div className="mb-4 h-px bg-gray-100" />

        <Form
          id="filters-form"
          method="get"
          className="grid grid-cols-1 md:grid-cols-12 gap-4"
        >
          {/* Buscar */}
          <div className="md:col-span-4">
            <label htmlFor="f-q" className="block text-xs font-medium text-gray-600">
              Buscar
            </label>
            <div className="relative mt-2">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="f-q"
                name="q"
                type="text"
                defaultValue={data.q}
                placeholder="ID, método, receiver o payer…"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
                aria-label="Buscar por ID, método, receiver o payer"
              />
            </div>
          </div>

          {/* Método */}
          <div className="md:col-span-2">
            <label htmlFor="f-metodo" className="block text-xs font-medium text-gray-600">
              Método
            </label>
            <select
              id="f-metodo"
              name="metodo"
              defaultValue={data.metodo}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
              aria-label="Filtrar por método de pago"
            >
              <option value="">Todos</option>
              {data.metodosDisponibles.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Desde */}
          <div className="md:col-span-2">
            <label htmlFor="f-from" className="block text-xs font-medium text-gray-600">
              Desde
            </label>
            <div className="relative mt-2">
              <LuCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="f-from"
                name="from"
                type="date"
                defaultValue={data.from}
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                aria-label="Fecha desde"
              />
            </div>
          </div>

          {/* Hasta */}
          <div className="md:col-span-2">
            <label htmlFor="f-to" className="block text-xs font-medium text-gray-600">
              Hasta
            </label>
            <div className="relative mt-2">
              <LuCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="f-to"
                name="to"
                type="date"
                defaultValue={data.to}
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                aria-label="Fecha hasta"
              />
            </div>
          </div>

          {/* Por página */}
          <div className="md:col-span-2">
            <label htmlFor="f-pageSize" className="block text-xs font-medium text-gray-600">
              Por página
            </label>
            <select
              id="f-pageSize"
              name="pageSize"
              defaultValue={String(data.pageSize)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
              aria-label="Cantidad por página"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Acciones */}
          <div className="md:col-span-12 flex items-end justify-end gap-2 pt-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Aplicar
            </button>
            <Link
              to={resetAll()}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Limpiar
            </Link>
          </div>
        </Form>

        {/* Chips */}
        {hasAnyFilter && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.q && <Chip label={`Buscar: ${data.q}`} to={clearParam("q")} />}
            {data.metodo && <Chip label={`Método: ${data.metodo}`} to={clearParam("metodo")} />}
            {data.from && <Chip label={`Desde: ${data.from}`} to={clearParam("from")} />}
            {data.to && <Chip label={`Hasta: ${data.to}`} to={clearParam("to")} />}
          </div>
        )}
      </section>

      {/* Tabla */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr>
                <Th /> {/* columna del toggle */}
                <Th>ID</Th>
                <Th>
                  <Link to={toggleSort("fecha")} className="inline-flex items-center gap-1 hover:underline">
                    Fecha <SortBadge active={data.sort === "fecha"} dir={data.dir} />
                  </Link>
                </Th>
                {/* Nueva columna: Productos */}
                <Th>Productos</Th>
                <Th>
                  <Link to={toggleSort("total")} className="inline-flex items-center gap-1 hover:underline">
                    Total <SortBadge active={data.sort === "total"} dir={data.dir} />
                  </Link>
                </Th>
                <Th>Método</Th>
                <Th>Payer</Th>
                <Th>Receiver</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <SkeletonRows cols={8} />
              ) : data.ventas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    No hay ventas registradas con estos filtros.
                  </td>
                </tr>
              ) : (
                data.ventas.flatMap((v) => {
                  const isOpen = !!openRows[v.id];
                  return (
                    [
                      <tr key={v.id} className="hover:bg-gray-50">
                        {/* Toggle */}
                        <Td className="w-10">
                          <button
                            onClick={() => toggleRow(v.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50"
                            aria-label={isOpen ? "Ocultar detalles" : "Ver detalles"}
                            title={isOpen ? "Ocultar detalles" : "Ver detalles"}
                          >
                            {isOpen ? <LuChevronDown className="h-4 w-4" /> : <LuChevronRight className="h-4 w-4" />}
                          </button>
                        </Td>
                        <Td className="font-medium text-gray-900">{v.id}</Td>
                        <Td>{fmtDate(v.fecha)}</Td>

                        {/* Productos preview */}
                        <Td>
                          {v.itemsCount === 0 ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                {v.itemsPreview.map((it, i) => (
                                  <img
                                    key={i}
                                    src={
                                      it.imagen_url ||
                                      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                                    }
                                    alt={it.nombre}
                                    title={it.nombre}
                                    className="h-8 w-8 rounded-md border border-gray-200 object-cover"
                                    loading="lazy"
                                  />
                                ))}
                              </div>
                              {v.itemsCount > v.itemsPreview.length && (
                                <span className="text-xs text-gray-600">
                                  +{v.itemsCount - v.itemsPreview.length}
                                </span>
                              )}
                            </div>
                          )}
                        </Td>

                        <Td className="font-semibold">{currency.format(Number(v.total))}</Td>
                        <Td className="capitalize">{v.metodo_pago ?? "—"}</Td>
                        <Td className="text-gray-600 truncate max-w-[260px]">
                          {v.payer_wallet ? (
                            <a
                              href={v.payer_wallet}
                              className="text-blue-700 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                              title={v.payer_wallet}
                            >
                              {v.payer_wallet}
                            </a>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="text-gray-600 truncate max-w-[260px]">
                          {v.receiver ? (
                            <a
                              href={v.receiver}
                              className="text-blue-700 hover:underline"
                              target="_blank"
                              rel="noreferrer"
                              title={v.receiver}
                            >
                              {v.receiver}
                            </a>
                          ) : (
                            "—"
                          )}
                        </Td>
                      </tr>,
                      isOpen ? (
                        <tr key={`d-${v.id}`} className="bg-gray-50/50">
                          <td colSpan={8} className="px-4 py-4">
                            {v.items.length === 0 ? (
                              <div className="text-sm text-gray-600">No hay detalles para esta venta.</div>
                            ) : (
                              <div className="space-y-3">
                                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                  Detalle de la venta
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {v.items.map((it, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
                                    >
                                      <div className="h-12 w-12 overflow-hidden rounded-md border border-gray-200 bg-gray-100 shrink-0">
                                        {it.imagen_url ? (
                                          <img
                                            src={it.imagen_url}
                                            alt={it.nombre}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="h-full w-full" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium text-gray-900">{it.nombre}</div>
                                        <div className="text-xs text-gray-600">
                                          Cant: <span className="font-medium">{it.cantidad}</span> · PU:{" "}
                                          <span className="font-medium">
                                            {currency.format(Number(it.precio_unitario))}
                                          </span>
                                        </div>
                                        <div className="text-sm font-semibold text-blue-600">
                                          {currency.format(Number(it.subtotal))}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-end pt-2">
                                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                                    Total: <strong>{currency.format(Number(v.total))}</strong>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null,
                    ].filter(Boolean) as ReactNode[]
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs sm:text-sm text-gray-600">
            Mostrando{" "}
            <span className="font-medium">
              {data.ventas.length ? (data.page - 1) * data.pageSize + 1 : 0}
            </span>{" "}
            –{" "}
            <span className="font-medium">
              {(data.page - 1) * data.pageSize + data.ventas.length}
            </span>{" "}
            de <span className="font-medium">{data.totalRows}</span>
          </p>
          <div className="flex items-center gap-2">
            <Link
              to={pageLink(Math.max(1, data.page - 1))}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                data.page <= 1
                  ? "pointer-events-none cursor-not-allowed bg-gray-200 text-gray-500"
                  : "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              }`}
            >
              Anterior
            </Link>
            <Link
              to={pageLink(Math.min(data.totalPages, data.page + 1))}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                data.page >= data.totalPages
                  ? "pointer-events-none cursor-not-allowed bg-gray-200 text-gray-500"
                  : "border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              }`}
            >
              Siguiente
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- UI Helpers --------------------------- */
function Card({
  title,
  value,
  hint,
  loading,
}: {
  title: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-3.5 w-24 rounded bg-gray-200" />
          <div className="h-6 w-40 rounded bg-gray-200" />
          <div className="h-2.5 w-28 rounded bg-gray-200" />
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-600">{title}</div>
          <div className="mt-0.5 text-[22px] font-semibold text-gray-900 tracking-tight">
            {value}
          </div>
          {hint ? <div className="mt-1 text-[11px] text-gray-500">{hint}</div> : null}
        </>
      )}
    </div>
  );
}

function Chip({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
      title="Quitar filtro"
    >
      {label}
      <LuX className="h-3.5 w-3.5" />
    </Link>
  );
}

function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-[13px] text-gray-700 ${className}`}>{children}</td>;
}
function SortBadge({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span
      className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1 text-[10px] ${
        active ? "border-gray-300 bg-white text-gray-700" : "border-gray-200 bg-white text-gray-400"
      }`}
      aria-label={active ? `Orden ${dir}` : "Orden"}
      title={active ? `Orden ${dir}` : "Orden"}
    >
      {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
}
function SkeletonRows({ cols = 7 }: { cols?: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 w-24 rounded bg-gray-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
