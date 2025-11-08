// app/routes/dashboard/index.tsx

export default function DashboardHome() {
  const stats = [
    { label: "Ventas Hoy", value: "$0.00", icon: "💰" },
    { label: "Productos", value: "0", icon: "📦" },
    { label: "Clientes", value: "0", icon: "👥" },
    { label: "Tickets", value: "0", icon: "🧾" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Bienvenido</h2>
        <p className="text-gray-600">Aquí está el resumen de tu negocio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stat.value}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Acciones Rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="text-2xl">➕</span>
            <div className="text-left">
              <div className="font-medium text-gray-900">Nueva Venta</div>
              <div className="text-sm text-gray-600">Registrar venta</div>
            </div>
          </button>
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="text-2xl">📦</span>
            <div className="text-left">
              <div className="font-medium text-gray-900">Agregar Producto</div>
              <div className="text-sm text-gray-600">Nuevo producto</div>
            </div>
          </button>
          <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="text-2xl">📊</span>
            <div className="text-left">
              <div className="font-medium text-gray-900">Ver Reportes</div>
              <div className="text-sm text-gray-600">Análisis</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}