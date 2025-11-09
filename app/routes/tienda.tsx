// app/routes/tienda.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  stock: number;
  imagen_url: string | null;
  descripcion_web?: string | null;
};

type CartItem = {
  id: number;
  nombre: string;
  precio_venta: number;
  cantidad: number;
  imagen_url?: string | null;
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function meta() {
  return [
    { title: "Tienda Online" },
    { name: "description", content: "Compra productos" },
  ];
}

export default function TiendaPublica() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<{ store_name: string; logo_url: string | null; brand_hex: string }>(
    { store_name: "MiShop", logo_url: null, brand_hex: "#2563eb" }
  );
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Cargar settings
  useEffect(() => {
    fetch(`${API_BASE}/api/store/settings`).then(r=>r.json()).then(d=>{
      const s = d?.settings || {};
      setSettings({
        store_name: s.store_name ?? "MiShop",
        logo_url: s.logo_url ?? null,
        brand_hex: s.brand_hex ?? "#2563eb",
      });
    }).catch(()=>{});
  }, []);

  // Cargar productos
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/store/products`)
      .then(r => r.json())
      .then(d => setProductos(d?.productos ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Cargar carrito de localStorage
  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) {
      try { setCart(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Guardar carrito
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (p: Producto) => {
    setCart(prev => {
      const found = prev.find(x => x.id === p.id);
      if (found) {
        const nuevaCantidad = Math.min(found.cantidad + 1, p.stock);
        return prev.map(x => x.id === p.id ? { ...x, cantidad: nuevaCantidad } : x);
      }
      return [...prev, { id: p.id, nombre: p.nombre, precio_venta: p.precio_venta, cantidad: 1, imagen_url: p.imagen_url || null }];
    });
  };

  const removeFromCart = (id: number) => setCart(prev => prev.filter(x => x.id !== id));
  const inc = (id: number) => setCart(prev => prev.map(x => x.id === id ? { ...x, cantidad: x.cantidad + 1 } : x));
  const dec = (id: number) => setCart(prev => prev.map(x => x.id === id ? { ...x, cantidad: Math.max(1, x.cantidad - 1) } : x));

  const count = cart.reduce((a, c) => a + c.cantidad, 0);
  const total = cart.reduce((a, c) => a + c.cantidad * c.precio_venta, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logo_url && <img src={settings.logo_url} className="h-10 w-10 rounded" alt="logo" />}
            <h1 className="text-2xl font-bold">{settings.store_name}</h1>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/tienda" className="text-gray-700 hover:text-blue-600">Productos</Link>
            <button
              onClick={() => navigate("/tienda/checkout")}
              className="relative px-4 py-2 rounded bg-blue-600 text-white"
            >
              Carrito ({count}) - ${total.toFixed(2)}
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold mb-1">Nuestros Productos</h2>
            <p className="text-gray-600">Todos los productos con stock aparecen automáticamente</p>
          </div>
          <button
            onClick={() => navigate("/tienda/checkout")}
            className="px-4 py-2 rounded bg-blue-600 text-white"
          >
            Ir al Checkout ({count})
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="h-12 w-12 rounded-full border-b-2 animate-spin" style={{ borderColor: settings.brand_hex }} />
          </div>
        ) : productos.length === 0 ? (
          <div className="bg-white border rounded-lg p-12 text-center text-gray-600">
            No hay productos disponibles
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productos.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden">
                <div className="bg-gray-100 h-48">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">Sin imagen</div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold mb-1 line-clamp-2">{p.nombre}</h3>
                  {(p.descripcion_web || p.descripcion) && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{p.descripcion_web || p.descripcion}</p>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold" style={{ color: settings.brand_hex }}>
                      ${p.precio_venta.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500">Stock: {p.stock}</span>
                  </div>
                  <button
                    onClick={() => addToCart(p)}
                    className="w-full py-2 rounded bg-green-600 text-white hover:bg-green-700"
                    disabled={p.stock <= 0}
                  >
                    Agregar al carrito
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mini carrito (opcional) */}
        {cart.length > 0 && (
          <div className="mt-10 bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Carrito rápido</h3>
            <div className="space-y-3">
              {cart.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden">
                      {c.imagen_url ? <img src={c.imagen_url} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div>
                      <div className="font-medium">{c.nombre}</div>
                      <div className="text-sm text-gray-600">${c.precio_venta.toFixed(2)} c/u</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 border rounded" onClick={() => dec(c.id)}>-</button>
                    <span className="w-8 text-center">{c.cantidad}</span>
                    <button className="px-2 py-1 border rounded" onClick={() => inc(c.id)}>+</button>
                    <button className="ml-3 text-red-600" onClick={() => removeFromCart(c.id)}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-lg font-bold">Total: ${total.toFixed(2)}</div>
              <button
                onClick={() => navigate("/tienda/checkout")}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Finalizar compra
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
