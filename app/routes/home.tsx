// app/routes/home.tsx

import type { Route } from "./+types/home";
import { Link } from "react-router";
import { PublicNavbar } from "../components/PublicNavbar";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "InterShop POS - Sistema de Punto de Venta" },
    { name: "description", content: "El mejor sistema de punto de venta para tu negocio" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  return null;
}

export default function Home() {
  const features = [
    {
      icon: "⚡",
      title: "Rápido y Eficiente",
      description: "Procesa ventas en segundos con nuestra interfaz intuitiva",
    },
    {
      icon: "📊",
      title: "Reportes en Tiempo Real",
      description: "Analiza tus ventas y toma decisiones informadas",
    },
    {
      icon: "📱",
      title: "Multi-Dispositivo",
      description: "Accede desde cualquier lugar, en cualquier momento",
    },
    {
      icon: "🔒",
      title: "100% Seguro",
      description: "Tus datos protegidos con los más altos estándares",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            El Punto de Venta
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Perfecto para tu Negocio
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Gestiona ventas, inventario y clientes desde una sola plataforma.
            Simple, rápido y poderoso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
            >
              Comenzar Gratis
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 text-lg font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
            >
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitas
            </h2>
            <p className="text-lg text-gray-600">
              Características diseñadas para hacer crecer tu negocio
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            ¿Listo para empezar?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Únete a cientos de negocios que confían en InterShop
          </p>
          <Link
            to="/register"
            className="inline-block px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            Crear Cuenta Gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">IS</span>
            </div>
            <span className="text-xl font-bold">InterShop</span>
          </div>
          <p className="text-gray-400">
            © 2025 InterShop POS. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}