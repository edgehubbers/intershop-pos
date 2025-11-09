// app/routes/tienda.pedidos.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router";
import { getSupabaseClient } from "../lib/supabase.client";

type Pedido = {
  id: number;
  fecha: string;
  estado: string;
  detalle_pedido: Array<{
    id: number;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    productos: {
      id: number;
      nombre: string;
      imagen_path: string | null; // luego reemplazamos con URL pública
    };
  }>;
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const BUCKET = import.meta.env.VITE_PRODUCTS_BUCKET || "product-images";

const estadoColors: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  pagado: "bg-blue-100 text-blue-800",
  enviado: "bg-purple-100 text-purple-800",
  entregado: "bg-green-100 text-green-800",
};

const estadoTexts: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
};

export default function MisPedidos() {
  const [correo, setCorreo] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const supabase = getSupabaseClient();
  const publicUrl = (path: string | null) =>
    path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null;

  useEffect(() => {
    const saved = localStorage.getItem("customerData");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.correo) {
          setCorreo(data.correo);
          loadPedidos(data.correo);
        }
      } catch (e) {
        console.error("Error cargando datos:", e);
      }
    }
  }, []);

  const loadPedidos = async (email: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/tienda/mis-pedidos?correo=${encodeURIComponent(email)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando pedidos");

      const data = await res.json();
      const pedidosConUrls: Pedido[] = (data.pedidos || []).map((p: Pedido) => ({
        ...p,
        detalle_pedido: p.detalle_pedido.map((d) => ({
          ...d,
          productos: {
            ...d.productos,
            imagen_path: publicUrl(d.productos.imagen_path),
          },
        })),
      }));
      setPedidos(pedidosConUrls);
    } catch (err: any) {
      setError(err.message || "Error cargando pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (correo.trim()) loadPedidos(correo.trim());
  };

  const calcularTotal = (detalle: Pedido["detalle_pedido"]) =>
    detalle.reduce((sum, item) => sum + Number(item.subtotal), 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link to="/tienda" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a la Tienda
          </Link>

          <h1 className="text-3xl font-bold text-gray-900">Mis Pedidos</h1>
          <p className="mt-2 text-gray-600">Consulta el estado y detalles de tus pedidos</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="Ingresa tu correo electrónico"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Buscando..." : "Buscar Pedidos"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-lg text-gray-600">No se encontraron pedidos</p>
            <p className="mt-2 text-sm text-gray-500">
              {correo ? "Verifica que el correo sea correcto" : "Ingresa tu correo para ver tus pedidos"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {pedidos.map((pedido) => (
              <div key={pedido.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Pedido #{pedido.id}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(pedido.fecha).toLocaleDateString("es-MX", {
                          year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColors[pedido.estado] || "bg-gray-100 text-gray-800"}`}>
                      {estadoTexts[pedido.estado] || pedido.estado}
                    </span>
                  </div>
                </div>

                <div className="px-6 py-4">
                  <div className="space-y-4">
                    {pedido.detalle_pedido.map((item) => (
                      <div key={item.id} className="flex items-center space-x-4">
                        <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded overflow-hidden">
                          {item.productos.imagen_path ? (
                            <img
                              src={item.productos.imagen_path}
                              alt={item.productos.nombre}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://via.placeholder.com/80?text=?"; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900">{item.productos.nombre}</h4>
                          <p className="text-sm text-gray-600 mt-1">Cantidad: {item.cantidad}</p>
                          <p className="text-sm text-gray-600">Precio unitario: ${Number(item.precio_unitario).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ${Number(item.subtotal).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span>Total del Pedido:</span>
                      <span className="text-blue-600">
                        ${calcularTotal(pedido.detalle_pedido).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {pedido.estado === "pagado" && (
                  <div className="bg-blue-50 px-6 py-3 border-t border-blue-100">
                    <p className="text-sm text-blue-800">✓ Tu pedido ha sido pagado y está siendo procesado para envío</p>
                  </div>
                )}
                {pedido.estado === "enviado" && (
                  <div className="bg-purple-50 px-6 py-3 border-t border-purple-100">
                    <p className="text-sm text-purple-800">📦 Tu pedido está en camino</p>
                  </div>
                )}
                {pedido.estado === "entregado" && (
                  <div className="bg-green-50 px-6 py-3 border-t border-green-100">
                    <p className="text-sm text-green-800">✅ Tu pedido ha sido entregado</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
