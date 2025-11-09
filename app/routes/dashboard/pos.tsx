// app/routes/dashboard/pos.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLoaderData } from "react-router";
import QRCode from "react-qr-code";
import { getSupabaseServer } from "../../lib/supabase.server";
import { LuImage } from "react-icons/lu";

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  stock: number;
  unidad_medida: string | null;
  imagen_path: string | null;
};

type LoaderData = {
  productos: (Producto & { imagen_url: string | null })[];
};

type PaymentPayload = {
  receiver?: string;
  paymentUrl?: string;
  assetCode?: string;
  assetScale?: number;
  expectedMinor?: number;
  amount: number;
  description: string;
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const BUCKET = (process.env.PRODUCTS_BUCKET || "product-images").trim();

// ------- Loader: catálogo de productos -------
export async function loader() {
  const supabase = getSupabaseServer();
  const { data: rows, error } = await supabase
    .from("productos")
    .select("id,nombre,descripcion,precio_venta,stock,unidad_medida,imagen_path")
    .order("nombre");

  if (error) throw new Response(error.message, { status: 500 });

  const productos =
    (rows ?? []).map((p) => ({
      ...p,
      imagen_url: p.imagen_path
        ? supabase.storage.from(BUCKET).getPublicUrl(p.imagen_path).data.publicUrl
        : null,
    })) ?? [];

  return { productos } satisfies LoaderData;
}

export default function POS() {
  const { productos } = useLoaderData<typeof loader>();

  const [cart, setCart] = useState<any[]>([]);
  const [payerWalletUrl, setPayerWalletUrl] = useState<string>(""); // 👈 solo para REGISTRO en la venta
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [lastReceiver, setLastReceiver] = useState<string>("");

  const [paymentDetails, setPaymentDetails] = useState<{
    receiver: string;
    amount: string;
    assetCode: string;
    expectedMinor: number;
    assetScale: number;
  } | null>(null);

  const pollingRef = useRef<number | null>(null);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.precio_venta) * item.quantity, 0),
    [cart]
  );

  const addToCart = (p: any) => {
    const existing = cart.find((i) => i.id === p.id);
    setCart(
      existing
        ? cart.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...cart, { ...p, quantity: 1 }]
    );
  };

  const removeFromCart = (id: number) => setCart(cart.filter((i) => i.id !== id));

  const updateQuantity = (id: number, quantity: number) =>
    quantity <= 0 ? removeFromCart(id) : setCart(cart.map((i) => (i.id === id ? { ...i, quantity } : i)));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMsg("✅ Copiado al portapapeles");
      setTimeout(() => setStatusMsg(""), 2000);
    } catch {
      alert("No se pudo copiar. Por favor, copia manualmente.");
    }
  };

  // ------- Generar receiver y empezar polling -------
  const generarReceiver = async () => {
    if (total <= 0) {
      setStatusMsg("⚠️ El total debe ser mayor a 0.");
      return;
    }

    setBusy(true);
    setStatusMsg("📝 Creando incoming payment (receiver)...");

    try {
      const response = await fetch(`${API_BASE}/api/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          amount: Number(total.toFixed(2)),
          description: `Venta POS: ${cart.map((i) => i.nombre).join(", ")}`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success || !result?.payment?.receiver) {
        throw new Error(result?.message || "No se pudo crear el incoming payment");
      }

      const payment = result.payment as PaymentPayload;
      const receiver = payment.receiver || payment.paymentUrl!;
      const assetScale = payment.assetScale ?? 2;
      const assetCode = payment.assetCode ?? "USD";
      const expectedMinor =
        payment.expectedMinor ??
        Math.round((payment.amount ?? Number(total.toFixed(2))) * Math.pow(10, assetScale));

      setLastReceiver(receiver);

      const amountDisplay = (expectedMinor / Math.pow(10, assetScale)).toFixed(assetScale);
      setPaymentDetails({
        receiver,
        amount: amountDisplay,
        assetCode,
        expectedMinor,
        assetScale,
      });

      setStatusMsg("✅ Receiver creado. Esperando pago del cliente…");

      // Snapshot de items para registrar detalle_venta cuando se confirme
      const itemsSnapshot = cart.map((i) => ({
        producto_id: i.id,
        cantidad: i.quantity,
        precio_unitario: Number(i.precio_venta),
      }));

      // Arranca polling y pasa payerWalletUrl (opcional) solo para guardar en DB
      startPolling(receiver, expectedMinor, assetCode, assetScale, payerWalletUrl || null, itemsSnapshot);
    } catch (error: any) {
      setStatusMsg(`❌ Error: ${error?.message || "No se pudo crear el receiver"}`);
      setBusy(false);
    }
  };

  const startPolling = (
    receiver: string,
    expectedMinor: number,
    assetCode: string,
    assetScale: number,
    customerWallet?: string | null, // 👈 se manda al backend para guardar en ventas.payer_wallet
    items?: Array<{ producto_id: number; cantidad: number; precio_unitario: number }>
  ) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);

    let attempts = 0;
    const maxAttempts = 120; // ~5 min a 2.5s

    const tick = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollingRef.current) {
          window.clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setStatusMsg("⏱️ Tiempo de espera agotado. El pago no se completó.");
        setBusy(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/payments/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiver,
            expectedMinor,
            assetCode,
            assetScale,
            metodo_pago: "open-payments",
            customerWallet: customerWallet || null, // 👈 aquí viaja al backend
            items: items || [],
          }),
        });

        const data = await res.json();

        if (data?.paid) {
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          setCart([]);
          setPaymentDetails(null);
          setBusy(false);

          setStatusMsg(
            `
🎉 ¡PAGO COMPLETADO!
━━━━━━━━━━━━━━━━━━
✅ Venta registrada
📝 ID: ${data?.ventaId ?? "—"}
💰 Monto recibido: ${(data?.receivedMinor / Math.pow(10, assetScale)).toFixed(assetScale)} ${assetCode}
━━━━━━━━━━━━━━━━━━
          `.trim()
          );

          setTimeout(() => {
            setStatusMsg("");
            setLastReceiver("");
          }, 5000);
        } else {
          const received = Number(data?.receivedMinor ?? 0);
          const expected = Number(data?.expectedMinor ?? expectedMinor);
          const percentage = Math.min(100, Math.round((received / Math.max(1, expected)) * 100));

          setStatusMsg(
            `
⏳ Esperando confirmación del pago...
━━━━━━━━━━━━━━━━━━
📊 Progreso: ${percentage}%
💵 Recibido: ${(received / Math.pow(10, assetScale)).toFixed(assetScale)} ${assetCode}
🎯 Esperado: ${(expected / Math.pow(10, assetScale)).toFixed(assetScale)} ${assetCode}
━━━━━━━━━━━━━━━━━━
${percentage > 0 ? "💡 Pago en progreso..." : "⏱️ Aún sin movimientos..."}
          `.trim()
          );
        }
      } catch (error) {
        console.error("Error en polling:", error);
      }
    };

    tick();
    pollingRef.current = window.setInterval(tick, 2500) as unknown as number;
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, []);

  const progressPct: number = (() => {
    const match = statusMsg.match(/(\d+)%/);
    if (match) return Math.min(100, Math.max(0, parseInt(match[1], 10)));
    if (statusMsg.includes("🎉")) return 100;
    return 0;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Punto de Venta</h2>
          <p className="text-gray-600">Selecciona productos y genera el Receiver para cobrar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catálogo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos Disponibles</h3>

            {productos.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No hay productos disponibles.</p>
                <p className="text-sm text-gray-500 mt-2">Agrega productos desde el menú de inventario.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {productos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                    className={`p-3 border rounded-lg transition-all text-left ${
                      p.stock <= 0
                        ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                        : "border-gray-200 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
                    }`}
                    title={p.stock <= 0 ? "Sin stock" : "Agregar al carrito"}
                  >
                    {/* Imagen */}
                    <div className="aspect-square w-full overflow-hidden rounded-md border border-gray-200 bg-white">
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                          <LuImage className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="mt-2">
                      <div className="font-medium text-gray-900 line-clamp-1">{p.nombre}</div>
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{p.descripcion || "Sin descripción"}</div>
                      <div className="text-base font-bold text-blue-600 mt-2">
                        ${Number(p.precio_venta).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {p.stock > 0 ? (
                          <>Stock: {p.stock} {p.unidad_medida || ""}</>
                        ) : (
                          <span className="text-red-600 font-medium">Sin stock</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Carrito + Pago */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Carrito de Compra</h3>

            {cart.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">🛒 Carrito vacío</p>
                <p className="text-xs text-gray-500 mt-2">Agrega productos del catálogo</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      {/* miniatura */}
                      <div className="mr-3 shrink-0">
                        <div className="h-12 w-12 overflow-hidden rounded-md border border-gray-200 bg-white">
                          {item.imagen_url ? (
                            <img src={item.imagen_url} alt={item.nombre} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-400">
                              <LuImage className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{item.nombre}</div>
                        <div className="text-sm text-gray-600">
                          ${Number(item.precio_venta).toFixed(2)} × {item.quantity}
                        </div>
                        <div className="text-sm font-medium text-blue-600">
                          = ${(Number(item.precio_venta) * item.quantity).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                          title="Reducir cantidad"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                          title="Aumentar cantidad"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="ml-2 text-red-600 hover:text-red-700 transition-colors"
                          title="Eliminar del carrito"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xl font-bold">
                    <span className="text-gray-700">Total:</span>
                    <span className="text-blue-600">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Wallet del cliente (opcional, solo registro) */}
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Wallet del cliente (opcional, solo para registrar)
                  </label>
                  <input
                    type="text"
                    value={payerWalletUrl}
                    onChange={(e) => setPayerWalletUrl(e.target.value)}
                    placeholder="https://ilp.example/wallet/cliente"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={busy}
                  />
                  <p className="text-xs text-gray-500">
                    Si lo dejas vacío, la venta se guarda sin <code>payer_wallet</code>.
                  </p>
                </div>

                {/* Botón único: Generar Receiver y esperar pago */}
                <button
                  onClick={generarReceiver}
                  disabled={busy}
                  className="w-full mt-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {busy ? "⏳ Procesando..." : "🧾 Generar Receiver y esperar pago"}
                </button>
              </>
            )}
          </div>

          {(paymentDetails || lastReceiver || statusMsg) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <h4 className="font-semibold text-blue-900 flex items-center">
                <span className="mr-2">💳</span>
                Estado del Pago
              </h4>

              {paymentDetails && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-800 mb-1">Receiver URL:</p>
                    <div className="p-2 bg-white border border-blue-300 rounded text-xs break-all text-blue-700 font-mono">
                      {paymentDetails.receiver}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => copy(paymentDetails.receiver)}
                        className="text-xs text-blue-700 underline hover:text-blue-900"
                      >
                        📋 Copiar Receiver
                      </button>
                      <button
                        onClick={() =>
                          copy(
                            `Receiver: ${paymentDetails.receiver}\nMonto: ${paymentDetails.amount} ${paymentDetails.assetCode}`
                          )
                        }
                        className="text-xs text-blue-700 underline hover:text-blue-900"
                      >
                        📋 Copiar Todo
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-blue-800 mb-1">Monto a Pagar:</p>
                    <div className="p-2 bg-white border border-blue-300 rounded">
                      <span className="text-lg font-bold text-blue-600">
                        {paymentDetails.amount} {paymentDetails.assetCode}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-blue-800 mb-2">Código QR:</p>
                    <div className="bg-white p-3 inline-block rounded border border-blue-300">
                      <QRCode value={paymentDetails.receiver} size={160} />
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      El cliente puede escanear este código con su wallet
                    </p>
                  </div>
                </div>
              )}

              {statusMsg && (
                <div className="bg-white border border-blue-300 rounded p-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-blue-900">Progreso</span>
                    <span className="font-bold text-blue-600">{progressPct}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-3 transition-all duration-500 ease-out ${
                        progressPct === 100 ? "bg-green-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-3 text-xs text-gray-700 whitespace-pre-line bg-gray-50 p-2 rounded">
                    {statusMsg}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
