// app/routes/dashboard/sales.tsx

export default function Sales() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Ventas</h2>
          <p className="text-gray-600">Historial de transacciones</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          + Nueva Venta
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600 text-center py-8">
          No hay ventas registradas aún
        </p>
      </div>
    </div>
  );
}