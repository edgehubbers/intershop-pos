// app/routes/tienda.callback.tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function TiendaCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const interact_ref = params.get("interact_ref");
    if (!interact_ref) {
      navigate("/tienda/checkout?op=error");
      return;
    }

    (async () => {
      try {
        const pendingStr = localStorage.getItem("op_pending");
        if (!pendingStr) throw new Error("Falta estado pending");
        const pending = JSON.parse(pendingStr);

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
        if (!res.ok || !j.ok) throw new Error(j?.message || "Error al finalizar concesión");

        localStorage.removeItem("op_pending");
        navigate("/tienda/checkout?op=ready", { replace: true });
      } catch (_e) {
        navigate("/tienda/checkout?op=error");
      }
    })();
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 bg-white border rounded shadow">
        <p className="font-medium">Procesando autorización…</p>
      </div>
    </div>
  );
}
