// app/routes/dashboard/sales.tsx
import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { useEffect, useMemo } from "react";
import { getSupabaseServer } from "../../lib/supabase.server";
import { LuSearch, LuCalendar, LuFilter, LuX } from "react-icons/lu";

/* ----------------------------- Tipos ----------------------------- */
type Venta = {
  id: number;
  fecha: string | null; // ISO
  total: string | number;
  metodo_pago: string | null;
  id_cliente: number | null;
  id_usuario: number | null;
  id_sucursal: number | null;
};

type LoaderData = {
  ventas: Venta[];
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
      "id, fecha, total, metodo_pago, id_cliente, id_usuario, id_sucursal",
      { count: "exact", head: false }
    );

  if (q) {
    const qNum = Number(q);
    qb = Number.isFinite(qNum)
      ? qb.or(`metodo_pago.ilike.%${q}%,id.eq.${Math.floor(qNum)}`)
      : qb.ilike("metodo_pago", `%${q}%`);
  }
  if (metodo) qb = qb.eq("metodo_pago", metodo);
  if (from) qb = qb.gte("fecha", new Date(`${from}T00:00:00`).toISOString());
  if (to) qb = qb.lt("fecha", addDaysISO(to, 1));

  const orderCol = sort === "total" ? "total" : "fecha";
  qb = qb.order(orderCol, { ascending: dir === "asc", nullsFirst: false })
         .order("id", { ascending: false, nullsFirst: false });

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  qb = qb.range(fromIdx, toIdx);

  const { data: ventas, count, error } = await qb;
  if (error) throw new Response(error.message, { status: 500 });

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
    ventas: ventas ?? [],
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

        {/* separador visual */}
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
                placeholder="ID o método de pago…"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
                aria-label="Buscar por ID o método de pago"
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
                <Th>ID</Th>
                <Th>
                  <Link to={toggleSort("fecha")} className="inline-flex items-center gap-1 hover:underline">
                    Fecha <SortBadge active={data.sort === "fecha"} dir={data.dir} />
                  </Link>
                </Th>
                <Th>
                  <Link to={toggleSort("total")} className="inline-flex items-center gap-1 hover:underline">
                    Total <SortBadge active={data.sort === "total"} dir={data.dir} />
                  </Link>
                </Th>
                <Th>Método</Th>
                <Th>Cliente</Th>
                <Th>Usuario</Th>
                <Th>Sucursal</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <SkeletonRows cols={7} />
              ) : data.ventas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No hay ventas registradas con estos filtros.
                  </td>
                </tr>
              ) : (
                data.ventas.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-900">{v.id}</Td>
                    <Td>{fmtDate(v.fecha)}</Td>
                    <Td className="font-semibold">{currency.format(Number(v.total))}</Td>
                    <Td className="capitalize">{v.metodo_pago ?? "—"}</Td>
                    <Td className="text-gray-600">{v.id_cliente ?? "—"}</Td>
                    <Td className="text-gray-600">{v.id_usuario ?? "—"}</Td>
                    <Td className="text-gray-600">{v.id_sucursal ?? "—"}</Td>
                  </tr>
                ))
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

function Th({ children }: { children: React.ReactNode }) {
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
  children: React.ReactNode;
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
