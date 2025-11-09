import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";

type CartItem = { id: number; nombre: string; precio_venta: number; cantidad: number; imagen_path?: string | null; };
type CustomerData = { nombre: string; correo: string; telefono: string; direccion: string; walletAddress: string; };

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerData, setCustomerData] = useState<CustomerData>({
    nombre: "", correo: "", telefono: "", direccion: "", walletAddress: "",
  });

  const [step, setStep] = useState<"info" | "payment" | "success">("info");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [paymentData, setPaymentData] = useState<{
    receiver: string;
    amount: string;
    assetCode: string;
    assetScale: number;
    expectedMinor: number;
  } | null>(null);

  const [statusMsg, setStatusMsg] = useState("");
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const pollingRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length === 0) navigate("/tienda");
        setCart(parsed);
      } catch {
        navigate("/tienda");
      }
    } else {
      navigate("/tienda");
    }
  }, [navigate]);

  useEffect(() => {
    const saved = localStorage.getItem("customerData");
    if (saved) { try { setCustomerData(JSON.parse(saved)); } catch {} }
  }, []);

  const total = cart.reduce((sum, item) => sum + item.precio_venta * item.cantidad, 0);

  useEffect(() => {
    const ok = params.get("op");
    if (ok === "ready") {
      const st = localStorage.getItem("op_payment_state");
      if (st) {
        try {
          const s = JSON.parse(st);
          setPaymentData({
            receiver: s.receiver,
            amount: (s.expectedMinor / Math.pow(10, s.assetScale)).toFixed(s.assetScale),
            assetCode: s.assetCode,
            assetScale: s.assetScale,
            expectedMinor: s.expectedMinor,
          });
          setPedidoId(s.pedidoId ?? null);
          setStep("payment");
          
          setTimeout(() => {
            startPolling(s.receiver, s.expectedMinor, s.assetCode, s.assetScale, s.pedidoId);
          }, 1000);
        } catch (e) {
          console.error("Error parseando payment state:", e);
          setError("Error al recuperar estado del pago");
        }
      }
    } else if (ok === "error") {
      setError("Error en la autorización del pago. Por favor intenta de nuevo.");
      setStep("info");
    }
  }, [params]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, []);

  const handleSubmitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customerData.nombre || !customerData.correo || !customerData.walletAddress) {
      setError("Por favor completa todos los campos obligatorios");
      return;
    }

    const walletAddr = customerData.walletAddress.trim();
    if (!walletAddr.startsWith('$') && !walletAddr.startsWith('http://') && !walletAddr.startsWith('https://')) {
      setError("Wallet Address debe comenzar con $ o https://");
      return;
    }

    localStorage.setItem("customerData", JSON.stringify(customerData));
    setLoading(true);

    try {
      const clienteRes = await fetch(`${API_BASE}/api/tienda/cliente`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: customerData.nombre,
          correo: customerData.correo,
          telefono: customerData.telefono,
          direccion: customerData.direccion,
        }),
      });
      
      if (!clienteRes.ok) {
        const errorData = await clienteRes.json();
        throw new Error(errorData.message || "Error registrando cliente");
      }
      
      const { cliente } = await clienteRes.json();

      const pedidoRes = await fetch(`${API_BASE}/api/tienda/pedido`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_cliente: cliente.id,
          items: cart.map((item) => ({
            producto_id: item.id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_venta,
          })),
        }),
      });
      
      if (!pedidoRes.ok) {
        const errorData = await pedidoRes.json();
        throw new Error(errorData.message || "Error creando pedido");
      }
      
      const { pedido } = await pedidoRes.json();
      setPedidoId(pedido.id);

      const startRes = await fetch(`${API_BASE}/api/op/checkout/start`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          description: `Pedido Online #${pedido.id}`,
          customerWalletAddress: customerData.walletAddress.trim(),
          pedidoId: pedido.id,
        }),
      });
      
      const start = await startRes.json();
      
      if (!startRes.ok || !start.ok) {
        throw new Error(start?.message || "Error iniciando pago");
      }

      const expectedMinor = Number(start.payment.expectedMinor);
      const assetCode = String(start.payment.assetCode);
      const assetScale = Number(start.payment.assetScale);
      const receiver = String(start.payment.receiver);

      setPaymentData({
        receiver,
        amount: (expectedMinor / Math.pow(10, assetScale)).toFixed(assetScale),
        assetCode,
        assetScale,
        expectedMinor,
      });

      localStorage.setItem("op_pending", JSON.stringify({
        continueUri: start.continue.uri,
        continueAccessToken: start.continue.accessToken,
        customerWalletAddress: customerData.walletAddress.trim(),
        receiver,
        expectedMinor,
        assetCode,
        assetScale,
        pedidoId: pedido.id,
      }));

      localStorage.setItem("op_payment_state", JSON.stringify({
        receiver, 
        expectedMinor, 
        assetCode, 
        assetScale, 
        pedidoId: pedido.id,
      }));

      console.log("Redirigiendo a:", start.redirect);
      window.location.href = start.redirect;
      
    } catch (err: any) {
      console.error("Error en handleSubmitInfo:", err);
      setError(err.message || "Error procesando el pedido");
      setLoading(false);
    }
  };

  const startPolling = (
    receiver: string,
    expectedMinor: number,
    assetCode: string,
    assetScale: number,
    pedidoId: number
  ) => {
    if (isPollingRef.current) {
      console.log("Polling ya está activo");
      return;
    }

    isPollingRef.current = true;

    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    let attempts = 0;
    const maxAttempts = 120;

    console.log("Iniciando polling para receiver:", receiver);

    const tick = async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        if (pollingRef.current) { 
          window.clearInterval(pollingRef.current); 
          pollingRef.current = null; 
        }
        isPollingRef.current = false;
        setStatusMsg("⏱️ Tiempo de espera agotado. Por favor contacta con soporte.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/tienda/confirmar-pago`, {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiver, 
            expectedMinor, 
            assetCode, 
            assetScale,
            pedidoId, 
            customerWallet: customerData.walletAddress,
          }),
        });

        if (res.status === 403) {
          if (pollingRef.current) { 
            window.clearInterval(pollingRef.current); 
            pollingRef.current = null; 
          }
          isPollingRef.current = false;
          setStatusMsg(
            "❌ 403 Forbidden del Resource Server.\n" +
            "Las credenciales GNAP del COMERCIO no coinciden con la wallet que generó este receiver.\n" +
            "Verifica WALLET_ADDRESS_URL / KEY_ID / Private Key del COMERCIO en el backend."
          );
          return;
        }

        if (!res.ok) {
          console.warn(`Polling attempt ${attempts}: HTTP ${res.status}`);
          return;
        }

        const data = await res.json();

        if (data?.paid) {
          if (pollingRef.current) { 
            window.clearInterval(pollingRef.current); 
            pollingRef.current = null; 
          }
          isPollingRef.current = false;
          
          localStorage.removeItem("cart");
          localStorage.removeItem("op_pending");
          localStorage.removeItem("op_payment_state");
          
          setCart([]);
          setStatusMsg(`
🎉 ¡PAGO COMPLETADO!
━━━━━━━━━━━━━━━━━━
✅ Pedido confirmado
📝 ID: ${pedidoId}
💰 Monto: ${(data.receivedMinor / Math.pow(10, assetScale)).toFixed(assetScale)} ${assetCode}
━━━━━━━━━━━━━━━━━━
          `.trim());
          setStep("success");
        } else {
          const received = Number(data?.receivedMinor ?? 0);
          const expected = Number(data?.expectedMinor ?? expectedMinor);
          const percentage = Math.min(100, Math.round((received / Math.max(1, expected)) * 100));
          
          console.log(`Polling attempt ${attempts}: ${percentage}% (${received}/${expected})`);
          
          setStatusMsg(`
⏳ Esperando confirmación...
━━━━━━━━━━━━━━━━━━
📊 Progreso: ${percentage}%
💵 Recibido: ${(received / Math.pow(10, assetScale)).toFixed(assetScale)} ${assetCode}
🎯 Esperado: ${(expected / Math.pow(10, assetScale)).toFixed(assetScale)} ${assetCode}
━━━━━━━━━━━━━━━━━━
${percentage > 0 ? "💡 Pago en progreso..." : "⏱️ Esperando aprobación en tu wallet..."}
          `.trim());
        }
      } catch (error) {
        console.warn(`Polling error attempt ${attempts}:`, error);
      }
    };

    tick();
    pollingRef.current = window.setInterval(tick, 2500) as unknown as number;
  };

  const progressPct = (() => {
    const match = statusMsg.match(/(\d+)%/);
    if (match) return Math.min(100, Math.max(0, parseInt(match[1], 10)));
    if (statusMsg.includes("🎉")) return 100;
    return 0;
  })();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Finalizar Compra</h1>
          <p className="mt-2 text-gray-600">
            {step === "info" && "Ingresa tus datos para completar el pedido"}
            {step === "payment" && "Autoriza en tu wallet y espera la confirmación"}
            {step === "success" && "¡Pedido realizado con éxito!"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === "info" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Información del Cliente</h2>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmitInfo} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                    <input 
                      type="text" 
                      required 
                      value={customerData.nombre}
                      onChange={(e) => setCustomerData({ ...customerData, nombre: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico *</label>
                    <input 
                      type="email" 
                      required 
                      value={customerData.correo}
                      onChange={(e) => setCustomerData({ ...customerData, correo: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input 
                      type="tel" 
                      value={customerData.telefono}
                      onChange={(e) => setCustomerData({ ...customerData, telefono: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección de Entrega</label>
                    <textarea 
                      rows={3} 
                      value={customerData.direccion}
                      onChange={(e) => setCustomerData({ ...customerData, direccion: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address (Open Payments) *</label>
                    <input 
                      type="text" 
                      required 
                      value={customerData.walletAddress}
                      onChange={(e) => setCustomerData({ ...customerData, walletAddress: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://ilp.interledger-test.dev/mishop2  ó  $ilp.interledger-test.dev/mishop2" 
                    />
                    <p className="mt-1 text-xs text-gray-600">
                      Se abrirá tu wallet para autorizar el pago.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Procesando..." : "Continuar y Autorizar en Wallet"}
                  </button>
                </form>
              </div>
            )}

            {step === "payment" && paymentData && (
              <div className="bg-white rounded-lg shadow p-6 space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Esperando Autorización</h2>

                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Receiver (Incoming Payment):</p>
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded break-all text-sm text-blue-700 font-mono">
                    {paymentData.receiver}
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText(paymentData.receiver)} 
                    className="mt-2 text-sm text-blue-700 underline hover:text-blue-900"
                  >
                    📋 Copiar Receiver
                  </button>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Monto a Recibir:</p>
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded">
                    <span className="text-2xl font-bold text-blue-600">
                      {paymentData.amount} {paymentData.assetCode}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Código QR (opcional):</p>
                  <div className="bg-white p-4 inline-block rounded border border-gray-300">
                    <QRCode value={paymentData.receiver} size={200} />
                  </div>
                </div>

                {statusMsg && (
                  <div className="bg-white border border-blue-300 rounded p-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-medium text-blue-900">Progreso</span>
                      <span className="font-bold text-blue-600">{progressPct}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-3 transition-all duration-300 ${progressPct === 100 ? "bg-green-500" : "bg-blue-500"}`} 
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="mt-3 text-xs text-gray-700 whitespace-pre-line bg-gray-50 p-3 rounded font-mono">
                      {statusMsg}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === "success" && (
              <div className="bg-white rounded-lg shadow p-6 text-center space-y-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">¡Pedido Confirmado!</h2>
                <p className="text-gray-600">Tu pedido #{pedidoId} ha sido procesado exitosamente.</p>
                <button 
                  onClick={() => navigate("/tienda")} 
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Volver a la Tienda
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Resumen del Pedido</h3>
              <div className="space-y-3 mb-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.nombre}</p>
                      <p className="text-gray-600">${item.precio_venta.toFixed(2)} × {item.cantidad}</p>
                    </div>
                    <p className="font-medium text-gray-900">${(item.precio_venta * item.cantidad).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">${total.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Envío</span>
                  <span className="font-medium text-gray-900">Gratis</span>
                </div>
                <div className="border-t pt-2 flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-blue-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>    
    </div>
  );
}

//app\routes\tienda.checkout.tsx