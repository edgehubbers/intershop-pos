//app\routes\dashboard\products.tsx

import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseServer } from "../../lib/supabase.server";
import { LuImage, LuPencil, LuPlus, LuX, LuSearch } from "react-icons/lu";

/* ----------------------------- Tipos ----------------------------- */
type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  id_categoria: number | null;
  precio_compra: number;
  precio_venta: number;
  stock: number;
  unidad_medida: string | null;
  codigo_barras: string | null;
  id_proveedor: number | null;
  id_sucursal: number | null;
  imagen_path: string | null;
};

type LoaderData = {
  productos: (Producto & { imagen_url: string | null })[];
  q: string;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

type ActionData =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/* --------------------------- Helpers ----------------------------- */
const PAGE_SIZE_DEFAULT = 12;
// Lee el bucket de env (server) y usa fallback
const BUCKET = (process.env.PRODUCTS_BUCKET || "product-images").trim();

const parsePositiveInt = (v: string | null, fb: number) =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : fb;

function randomPath(originalName: string) {
  const safeName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `products/${slug}-${safeName}`;
}

/* ------------------------------ Loader --------------------------- */
export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), PAGE_SIZE_DEFAULT);

  const supabase = getSupabaseServer();

  let qb = supabase
    .from("productos")
    .select(
      "id,nombre,descripcion,id_categoria,precio_compra,precio_venta,stock,unidad_medida,codigo_barras,id_proveedor,id_sucursal,imagen_path",
      { count: "exact", head: false }
    );

  if (q) {
    const qNum = Number(q);
    qb = Number.isFinite(qNum)
      ? qb.or(`id.eq.${Math.floor(qNum)},nombre.ilike.%${q}%,codigo_barras.ilike.%${q}%`)
      : qb.or(`nombre.ilike.%${q}%,codigo_barras.ilike.%${q}%`);
  }

  qb = qb.order("id", { ascending: false });

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  qb = qb.range(fromIdx, toIdx);

  const { data, count, error } = await qb;
  if (error) throw new Response(error.message, { status: 500 });

  const productos =
    (data ?? []).map((p) => ({
      ...p,
      imagen_url: p.imagen_path
        ? supabase.storage.from(BUCKET).getPublicUrl(p.imagen_path).data.publicUrl
        : null,
    })) ?? [];

  const totalRows = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return {
    productos,
    q,
    page,
    pageSize,
    totalRows,
    totalPages,
  } satisfies LoaderData;
}

/* ------------------------------ Action --------------------------- */
export async function action({ request }: { request: Request }) {
  const supabase = getSupabaseServer();

  try {
    const form = await request.formData();
    const intent = String(form.get("_action") || "");

    // Campos comunes
    const nombre = String(form.get("nombre") || "").trim();
    const descripcion = String(form.get("descripcion") || "").trim() || null;
    const precio_compra = Number(form.get("precio_compra") || 0);
    const precio_venta = Number(form.get("precio_venta") || 0);
    const stock = Number(form.get("stock") || 0);
    const unidad_medida =
      (String(form.get("unidad_medida") || "").trim() || null) as string | null;
    const codigo_barras =
      (String(form.get("codigo_barras") || "").trim() || null) as string | null;
    const id_categoria = form.get("id_categoria") ? Number(form.get("id_categoria")) : null;
    const id_proveedor = form.get("id_proveedor") ? Number(form.get("id_proveedor")) : null;
    const id_sucursal = form.get("id_sucursal") ? Number(form.get("id_sucursal")) : null;

    // Archivo (si viene)
    const file = form.get("imagen") as File | null;

    async function maybeUpload(): Promise<string | null> {
      if (!file || !file.size) return null;

      // Validaciones básicas
      const maxBytes = 5 * 1024 * 1024; // 5MB
      if (file.size > maxBytes) {
        throw new Error("La imagen excede 5MB. Comprime o sube una más ligera.");
      }

      const path = randomPath(file.name);
      const arrayBuffer = await file.arrayBuffer();

      // SUBIDA: pasamos el ArrayBuffer directamente; setea contentType
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
        cacheControl: "3600",
      });

      if (upErr) {
        // Mensaje claro si el bucket no existe
        if (String(upErr.message || "").toLowerCase().includes("bucket not found")) {
          throw new Error(
            `Bucket "${BUCKET}" no encontrado. Verifica el nombre y que tu server use las mismas credenciales del proyecto donde creaste el bucket.`
          );
        }
        throw new Error(upErr.message);
      }
      return path;
    }

    if (intent === "create") {
      const imagen_path = await maybeUpload();
      const { error } = await supabase.from("productos").insert([
        {
          nombre,
          descripcion,
          precio_compra,
          precio_venta,
          stock,
          unidad_medida,
          codigo_barras,
          id_categoria,
          id_proveedor,
          id_sucursal,
          imagen_path,
        },
      ]);
      if (error) throw new Error(error.message);
      return { ok: true, message: "Producto creado" } satisfies ActionData;
    }

    if (intent === "update") {
      const id = Number(form.get("id"));
      if (!id) return { ok: false, error: "ID inválido" } satisfies ActionData;

      const prev_imagen_path = String(form.get("prev_imagen_path") || "") || null;

      let imagen_path: string | null | undefined = undefined; // undefined = no tocar
      if (file && file.size) {
        imagen_path = await maybeUpload();
      }

      const payload: any = {
        nombre,
        descripcion,
        precio_compra,
        precio_venta,
        stock,
        unidad_medida,
        codigo_barras,
        id_categoria,
        id_proveedor,
        id_sucursal,
      };
      if (imagen_path !== undefined) payload.imagen_path = imagen_path;

      const { error } = await supabase.from("productos").update(payload).eq("id", id);
      if (error) throw new Error(error.message);

      // Limpieza: si subimos nueva imagen y había una anterior, intento borrarla
      if (imagen_path && prev_imagen_path && prev_imagen_path !== imagen_path) {
        await supabase.storage.from(BUCKET).remove([prev_imagen_path]).catch(() => {});
      }

      return { ok: true, message: "Producto actualizado" } satisfies ActionData;
    }

    if (intent === "delete") {
      const id = Number(form.get("id"));
      if (!id) return { ok: false, error: "ID inválido" } satisfies ActionData;

      const prev_imagen_path = String(form.get("prev_imagen_path") || "") || null;

      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw new Error(error.message);

      if (prev_imagen_path) {
        await supabase.storage.from(BUCKET).remove([prev_imagen_path]).catch(() => {});
      }

      return { ok: true, message: "Producto eliminado" } satisfies ActionData;
    }

    return { ok: false, error: "Acción no válida" } satisfies ActionData;
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error procesando la solicitud" } satisfies ActionData;
  }
}

/* ----------------------------- Componente ---------------------------- */
export default function Products() {
  const data = useLoaderData() as LoaderData;
  const action = useActionData() as ActionData | undefined;
  const navigation = useNavigation();

  const [searchParams] = useSearchParams();
  const submit = useSubmit();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<(Producto & { imagen_url?: string | null }) | null>(null);

  // auto-submit de filtros
  useEffect(() => {
    const form = document.getElementById("search-form") as HTMLFormElement | null;
    if (!form) return;
    const handler = () => submit(form, { replace: true });
    form.querySelectorAll("input, select").forEach((el) => el.addEventListener("change", handler));
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

  const pageLink = (n: number) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("page", String(n));
    return `?${sp.toString()}`;
  };

  return (
    <main className="page space-y-6 md:space-y-7">
      {/* Mensajes de acción */}
      {action && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            action.ok
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {action.ok ? action.message || "Operación realizada" : action.error}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">Productos</h2>
          <p className="text-sm text-gray-500">Gestiona tu inventario</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <LuPlus className="h-4 w-4" />
          Agregar Producto
        </button>
      </header>

      {/* Buscador */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
        <Form id="search-form" method="get" className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6">
            <label htmlFor="q" className="block text-xs font-medium text-gray-600">
              Buscar
            </label>
            <div className="relative mt-2">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="q"
                name="q"
                type="text"
                defaultValue={data.q}
                placeholder="Nombre, código barras o ID…"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="pageSize" className="block text-xs font-medium text-gray-600">
              Por página
            </label>
            <select
              id="pageSize"
              name="pageSize"
              defaultValue={String(PAGE_SIZE_DEFAULT)}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
            >
              {[12, 24, 48].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Aplicar
            </button>
          </div>
        </Form>
      </section>

      {/* Tabla */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {data.productos.length === 0 ? (
          <div className="py-12 text-center text-gray-600">
            No hay productos registrados aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <Th>Imagen</Th>
                  <Th>Nombre</Th>
                  <Th>Precio</Th>
                  <Th>Stock</Th>
                  <Th>Código</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.productos.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <Td>
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          className="h-12 w-12 rounded-lg object-cover border border-gray-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400">
                          <LuImage className="h-5 w-5" />
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="font-medium text-gray-900">{p.nombre}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {p.descripcion || "—"}
                      </div>
                    </Td>
                    <Td className="font-semibold">{currency.format(p.precio_venta)}</Td>
                    <Td>{p.stock}</Td>
                    <Td className="text-gray-600">{p.codigo_barras || "—"}</Td>
                    <Td>
                      <button
                        onClick={() => {
                          setEditing(p);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <LuPencil className="h-4 w-4" />
                        Editar
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs sm:text-sm text-gray-600">
            Total <span className="font-medium">{data.totalRows}</span> productos
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

      {/* Modal Crear/Editar */}
      {modalOpen && (
        <Modal
          onClose={() => setModalOpen(false)}
          title={editing ? "Editar producto" : "Nuevo producto"}
        >
          <Form
            method="post"
            encType="multipart/form-data"
            className="space-y-4"
            onSubmit={() => setModalOpen(false)}
          >
            <input type="hidden" name="_action" value={editing ? "update" : "create"} />
            {editing && <input type="hidden" name="id" value={String(editing.id)} />}
            {editing?.imagen_path && (
              <input type="hidden" name="prev_imagen_path" value={editing.imagen_path} />
            )}

            {/* Imagen */}
            <div className="flex items-center gap-4">
              {editing?.imagen_url ? (
                <img
                  src={editing.imagen_url}
                  alt={editing.nombre}
                  className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400">
                  <LuImage className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1">
                <label htmlFor="imagen" className="block text-xs font-medium text-gray-600">
                  Imagen (opcional)
                </label>
                <input
                  id="imagen"
                  name="imagen"
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-white hover:file:bg-gray-800"
                />
                <p className="mt-1 text-xs text-gray-500">Se subirá a Supabase Storage</p>
              </div>
            </div>

            {/* Nombre y precios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nombre" className="block text-xs font-medium text-gray-600">
                  Nombre
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  required
                  defaultValue={editing?.nombre || ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>

              <div>
                <label htmlFor="codigo_barras" className="block text-xs font-medium text-gray-600">
                  Código de barras
                </label>
                <input
                  id="codigo_barras"
                  name="codigo_barras"
                  type="text"
                  defaultValue={editing?.codigo_barras || ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>

              <div>
                <label htmlFor="precio_compra" className="block text-xs font-medium text-gray-600">
                  Precio compra
                </label>
                <input
                  id="precio_compra"
                  name="precio_compra"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={editing?.precio_compra ?? ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>

              <div>
                <label htmlFor="precio_venta" className="block text-xs font-medium text-gray-600">
                  Precio venta
                </label>
                <input
                  id="precio_venta"
                  name="precio_venta"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={editing?.precio_venta ?? ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* Stock y unidad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="stock" className="block text-xs font-medium text-gray-600">
                  Stock
                </label>
                <input
                  id="stock"
                  name="stock"
                  type="number"
                  step="1"
                  min="0"
                  required
                  defaultValue={editing?.stock ?? 0}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label htmlFor="unidad_medida" className="block text-xs font-medium text-gray-600">
                  Unidad (pza, kg, lt…)
                </label>
                <input
                  id="unidad_medida"
                  name="unidad_medida"
                  type="text"
                  defaultValue={editing?.unidad_medida || ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="descripcion" className="block text-xs font-medium text-gray-600">
                Descripción
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                rows={3}
                defaultValue={editing?.descripcion || ""}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
              />
            </div>

            {/* Campos opcionales simples (IDs) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="id_categoria" className="block text-xs font-medium text-gray-600">
                  ID categoría
                </label>
                <input
                  id="id_categoria"
                  name="id_categoria"
                  type="number"
                  min="0"
                  defaultValue={editing?.id_categoria ?? ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label htmlFor="id_proveedor" className="block text-xs font-medium text-gray-600">
                  ID proveedor
                </label>
                <input
                  id="id_proveedor"
                  name="id_proveedor"
                  type="number"
                  min="0"
                  defaultValue={editing?.id_proveedor ?? ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label htmlFor="id_sucursal" className="block text-xs font-medium text-gray-600">
                  ID sucursal
                </label>
                <input
                  id="id_sucursal"
                  name="id_sucursal"
                  type="number"
                  min="0"
                  defaultValue={editing?.id_sucursal ?? ""}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
              >
                {editing ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </Form>
        </Modal>
      )}
    </main>
  );
}

/* --------------------------- UI Helpers --------------------------- */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50">
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-[13px] text-gray-700 ${className}`}>{children}</td>;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 p-1 text-gray-600 hover:bg-gray-50"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
