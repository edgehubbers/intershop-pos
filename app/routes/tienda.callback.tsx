import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function TiendaCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const interact_ref = params.get("interact_ref");
    
    if (!interact_ref) {
      console.error("Falta interact_ref en callback");
      navigate("/tienda/checkout?op=error");
      return;
    }

    (async () => {
      try {
        const pendingStr = localStorage.getItem("op_pending");
        
        if (!pendingStr) {
          console.error("Falta estado pending en localStorage");
          throw new Error("Falta estado de pago pendiente");
        }

        const pending = JSON.parse(pendingStr);
        
        if (!pending.continueUri || !pending.continueAccessToken || !pending.customerWalletAddress || !pending.receiver) {
          console.error("Datos incompletos en pending:", pending);
          throw new Error("Datos de pago incompletos");
        }

        console.log("Continuando grant con interact_ref:", interact_ref);

        const res = await fetch(`${API_BASE}/api/op/checkout/continue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            continueUri: pending.continueUri,
            continueAccessToken: pending.continueAccessToken,
            interact_ref,
            customerWalletAddress: pending.customerWalletAddress,
            receiver: pending.receiver,
            pedidoId: pending.pedidoId,
          }),
        });

        const j = await res.json();
        
        if (!res.ok) {
          console.error("Error en continue:", j);
          throw new Error(j?.message || `Error HTTP ${res.status}`);
        }

        if (!j.ok) {
          console.error("Response not ok:", j);
          throw new Error(j?.message || "Error al finalizar concesión");
        }

        console.log("Grant finalizado exitosamente, creando outgoing payment");
        
        localStorage.removeItem("op_pending");
        navigate("/tienda/checkout?op=ready", { replace: true });
        
      } catch (err: any) {
        console.error("Error en callback:", err);
        setError(err.message || "Error procesando autorización");
        setProcessing(false);
        
        setTimeout(() => {
          navigate("/tienda/checkout?op=error");
        }, 2000);
      }
    })();
  }, [navigate, params]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full">
          <div className="bg-white border border-red-300 rounded-lg shadow p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Error en Autorización</h2>
            <p className="text-sm text-red-700 text-center mb-4">{error}</p>
            <p className="text-xs text-gray-600 text-center">Redirigiendo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full">
          <div className="bg-white border border-blue-300 rounded-lg shadow p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Procesando Autorización</h2>
            <p className="text-sm text-gray-600 text-center">
              Estamos finalizando tu autorización de pago...
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center text-xs text-gray-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full mr-2"></div>
                <span>Validando credenciales</span>
              </div>
              <div className="flex items-center text-xs text-gray-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></div>
                <span>Creando orden de pago</span>
              </div>
              <div className="flex items-center text-xs text-gray-600">
                <div className="w-2 h-2 bg-gray-300 rounded-full mr-2"></div>
                <span>Confirmando transacción</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}