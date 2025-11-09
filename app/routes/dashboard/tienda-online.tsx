// app/routes/dashboard/tienda-online.tsx
import { useEffect, useState } from "react";

type StoreSettings = { store_name: string; logo_url: string | null; brand_hex: string | null };

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function TiendaOnlineAdmin() {
  const [settings, setSettings] = useState<StoreSettings>({
    store_name: "MiShop",
    logo_url: null,
    brand_hex: "#2563eb",
  });
  const [savingMsg, setSavingMsg] = useState("");

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const r = await fetch(`${API_BASE}/api/store/settings`);
      const j = await r.json();
      if (j?.settings) setSettings(j.settings);
    } catch {}
  }

  async function saveSettings() {
    try {
      setSavingMsg("Guardando…");
      const r = await fetch(`${API_BASE}/api/store/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.message || "Error");
      setSavingMsg("Guardado ✔");
    } catch (e: any) {
      setSavingMsg(`Error: ${e.message}`);
    } finally {
      setTimeout(() => setSavingMsg(""), 2000);
    }
  }

  const tiendaUrl = `${window.location.origin}/tienda`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tienda Online</h2>
          <p className="text-gray-600">La tienda muestra automáticamente todos los productos con stock</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">URL de tu tienda</p>
          <a href={tiendaUrl} className="text-blue-600 underline" target="_blank" rel="noreferrer">
            {tiendaUrl}
          </a>
        </div>
      </div>

      <div className="bg-white border rounded p-4 space-y-3">
        <h3 className="font-semibold">Identidad de la tienda</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-600">Nombre</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={settings.store_name || ""}
              onChange={(e) => setSettings((s) => ({ ...s, store_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Logo URL</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={settings.logo_url || ""}
              onChange={(e) => setSettings((s) => ({ ...s, logo_url: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Color (hex)</label>
            <input
              className="mt-1 w-full border rounded px-2 py-1"
              value={settings.brand_hex || "#2563eb"}
              onChange={(e) => setSettings((s) => ({ ...s, brand_hex: e.target.value }))}
            />
          </div>
        </div>
        <button onClick={saveSettings} className="px-3 py-2 bg-blue-600 text-white rounded">Guardar</button>
        {savingMsg && <span className="ml-3 text-sm">{savingMsg}</span>}
        <a
          href={tiendaUrl}
          className="ml-3 px-3 py-2 bg-green-600 text-white rounded"
          target="_blank"
          rel="noreferrer"
        >
          Abrir tienda
        </a>
      </div>
    </div>
  );
}
