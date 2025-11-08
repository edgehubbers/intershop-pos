// app/routes/dashboard/pos.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLoaderData, useActionData, Form } from "react-router";
import QRCode from "react-qr-code";
import { createPaymentRequest } from "../../lib/open-payments.server";
import { getSupabaseServer } from "../../lib/supabase.server";

type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  stock: number;
  unidad_medida: string | null;
};

type LoaderData = {
  productos: Producto[];
  walletAddressUrl: string; // tu pointer/Wallet Address de merchant
};

type PaymentPayload = {
  receiver?: string;        // URL del incoming payment (Receiver real)
  paymentUrl?: string;      // alias por compatibilidad
  walletAddressUrl?: string;
  assetCode?: string;
  assetScale?: number;
  expectedMinor?: number;   // monto esperado en minor units
  amount: number;           // monto decimal (UI)
  description: string;
};

type ActionOk = { success: true; payment: PaymentPayload; walletAddressUrl?: string };
type ActionErr = { success: false; error: string };

function isOk(a: ActionOk | ActionErr | undefined): a is ActionOk {
  return !!a && (a as any).success === true;
}

export async function loader() {
  const supabase = getSupabaseServer();
  const { data: productos } = await supabase.from("productos").select("*").order("nombre");
  const walletAddressUrl =
    process.env.WALLET_ADDRESS_URL || "https://ilp.interledger-test.dev/mishop";
  return { productos: productos || [], walletAddressUrl } satisfies LoaderData;
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  if (action === "create-payment") {
    const amount = parseFloat(String(formData.get("amount") ?? "0"));
    const description = String(formData.get("description") ?? "");
    try {
      const payment = await createPaymentRequest(amount, description);
      const walletAddressUrl =
        process.env.WALLET_ADDRESS_URL || "https://ilp.interledger-test.dev/mishop";
      return { success: true, payment, walletAddressUrl } satisfies ActionOk;
    } catch (error: any) {
      return { success: false, error: error?.message || "Error desconocido" } satisfies ActionErr;
    }
  }
  return { success: false, error: "Acción no válida" } satisfies ActionErr;
}

export default function POS() {
  const { productos, walletAddressUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionOk | ActionErr>();
  const ok = isOk(actionData) ? actionData : undefined;

  const [cart, setCart] = useState<any[]>([]);
  const [mode, setMode] = useState<"receiver" | "pointer">("receiver"); // seguimos permitiendo elegir
  const [progress, setProgress] = useState<{ received: number; expected: number } | null>(null);
  const [ventaId, setVentaId] = useState<number | null>(null);
  const [ventaError, setVentaError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.precio_venta) * item.quantity, 0),
    [cart]
  );

  const addToCart = (p: any) => {
    const existing = cart.find((i) => i.id === p.id);
    setCart(existing
      ? cart.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
      : [...cart, { ...p, quantity: 1 }]);
  };
  const removeFromCart = (id: number) => setCart(cart.filter((i) => i.id !== id));
  const updateQuantity = (id: number, quantity: number) =>
    quantity <= 0 ? removeFromCart(id) : setCart(cart.map((i) => (i.id === id ? { ...i, quantity } : i)));

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert("Copiado ✅"); } catch {}
  };

  // Valores del action al generar el cobro (no tocamos tu flujo)
  const receiverFromAction: string = ok
    ? (ok.payment.receiver || ok.payment.paymentUrl || "")
    : "";

  const pointerFromAction: string = ok
    ? (ok.payment.walletAddressUrl || ok.walletAddressUrl || walletAddressUrl)
    : walletAddressUrl;

  const assetScale: number = ok?.payment.assetScale ?? 2;
  const assetCode: string = ok?.payment.assetCode ?? "USD";
  const expectedMinor: number =
    ok?.payment.expectedMinor ??
    Math.round(((ok?.payment.amount ?? total) as number) * Math.pow(10, assetScale));

  // Polling de confirmación del Receiver (sin cambios en tu backend)
  useEffect(() => {
    if (!ok || !receiverFromAction) return;

    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setVentaError(null);

    const tick = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiver: receiverFromAction,
            expectedMinor,
            assetCode,
            assetScale,
            metodo_pago: "open-payments"
          })
        });
        const data = await res.json();
        const rec: number = Number(data?.receivedMinor ?? 0);
        const exp: number = Number(data?.expectedMinor ?? expectedMinor);

        if (data?.paid) {
          if (!data?.ventaId) {
            setVentaError(
              data?.dbError?.message
                ? `Pago confirmado, pero no se registró la venta: ${data.dbError.message}`
                : "Pago confirmado, pero no se registró la venta (revisa RLS/policies)."
            );
          } else {
            setVentaId(Number(data.ventaId));
            setCart([]); // vaciamos solo si la venta existe
          }
          setProgress({ received: rec, expected: exp });
          if (pollingRef.current) {
            window.clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else {
          setProgress({ received: rec, expected: exp });
        }
      } catch {
        // ignorar intermitencias
      }
    };

    tick();
    pollingRef.current = window.setInterval(tick, 3000) as unknown as number;

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [ok, receiverFromAction, expectedMinor, assetCode, assetScale]);

  const progressPct: number = (() => {
    const rec = progress?.received ?? 0;
    const exp = progress?.expected ?? expectedMinor;
    const denom = Math.max(1, exp);
    return Math.min(100, Math.max(0, Math.round((rec / denom) * 100)));
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Punto de Venta</h2>
          <p className="text-gray-600">Selecciona productos y cobra</p>
        </div>
      </div>

      {/* Modo de cobro (sin wallet del cliente) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Modo de cobro</label>
        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-1">
            <input type="radio" checked={mode === "receiver"} onChange={() => setMode("receiver")} />
            Receiver (monto fijo)
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="radio" checked={mode === "pointer"} onChange={() => setMode("pointer")} />
            Pointer (cliente ingresa el monto)
          </label>
        </div>
        {mode === "pointer" ? (
          <p className="text-xs text-gray-600 mt-1">
            El Payment Pointer <b>no</b> precarga monto. El cliente introduce{" "}
            <b>{(expectedMinor / Math.pow(10, assetScale)).toFixed(2)} {assetCode}</b> en su wallet.
          </p>
        ) : (
          <p className="text-xs text-gray-600 mt-1">
            Receiver fija el monto y permite confirmar automáticamente.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Productos Disponibles</h3>
            {productos.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No hay productos disponibles. Agrega algunos.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {productos.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="font-medium text-gray-900">{p.nombre}</div>
                    <div className="text-sm text-gray-600">{p.descripcion || 'Sin descripción'}</div>
                    <div className="text-lg font-bold text-blue-600 mt-2">
                      ${Number(p.precio_venta).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Stock: {p.stock} {p.unidad_medida || ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Carrito + cobro */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Carrito</h3>

            {cart.length === 0 ? (
              <p className="text-gray-600 text-center py-8">Carrito vacío</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.nombre}</div>
                      <div className="text-sm text-gray-600">
                        ${Number(item.precio_venta).toFixed(2)} x {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">-</button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300">+</button>
                      <button onClick={() => removeFromCart(item.id)} className="ml-2 text-red-600 hover:text-red-700">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <>
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xl font-bold">
                    <span>Total:</span>
                    <span className="text-blue-600">${total.toFixed(2)}</span>
                  </div>
                </div>

                <Form method="post" className="mt-4">
                  <input type="hidden" name="action" value="create-payment" />
                  <input type="hidden" name="amount" value={total.toFixed(2)} />
                  <input type="hidden" name="description" value={`Venta: ${cart.map((i) => i.nombre).join(", ")}`} />
                  <button type="submit" className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Generar cobro
                  </button>
                </Form>
              </>
            )}
          </div>

          {/* Resultado + Progreso + QR */}
          {ok ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
              <h4 className="font-semibold text-green-900">¡Cobro creado!</h4>

              {/* Receiver (texto + copy) - NO tocamos tu flujo */}
              <div>
                <p className="text-sm font-semibold text-green-800">Receiver URL (pégalo en la wallet):</p>
                <div className="p-3 bg-white border border-green-300 rounded break-all text-sm text-blue-700">
                  {receiverFromAction}
                </div>
                <button onClick={() => copy(receiverFromAction)} className="mt-1 text-xs text-blue-700 underline">
                  Copiar Receiver
                </button>
              </div>

              {/* Pointer en QR (nuevo) */}
              <div className="mt-3">
                <p className="text-sm font-semibold text-green-800">Payment Pointer (QR):</p>
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 inline-block rounded border">
                    <QRCode value={pointerFromAction} size={140} />
                  </div>
                  <div className="text-xs text-gray-700">
                    Escanea este QR en la app del cliente para rellenar el <b>pointer</b>. 
                    El cliente deberá ingresar el monto <b>{(expectedMinor / Math.pow(10, assetScale)).toFixed(2)} {assetCode}</b> manualmente.
                  </div>
                </div>
                <button onClick={() => copy(pointerFromAction)} className="mt-2 text-xs text-blue-700 underline">
                  Copiar Pointer
                </button>
              </div>

              {/* Progreso (sigue atado al Receiver) */}
              <div className="bg-white border rounded p-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Progreso</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full mt-2 h-2 bg-gray-200 rounded overflow-hidden">
                  <div className="h-2 bg-green-500" style={{ width: `${progressPct}%`, transition: "width 300ms" }} />
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Recibido: {(progress?.received ?? 0) / Math.pow(10, assetScale)} {assetCode} / Esperado: {(progress?.expected ?? expectedMinor) / Math.pow(10, assetScale)} {assetCode}
                </div>
              </div>

              {ventaId ? (
                <div className="bg-green-100 border border-green-300 rounded p-3 text-sm">
                  ✅ Pago confirmado y venta registrada (ID: <b>{ventaId}</b>). Carrito vaciado.
                </div>
              ) : ventaError ? (
                <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-800">
                  ⚠️ {ventaError}
                </div>
              ) : (
                <div className="text-xs text-gray-600">Esperando confirmación del pago…</div>
              )}
            </div>
          ) : null}

          {actionData && !isOk(actionData) ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">Error: {actionData.error}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
