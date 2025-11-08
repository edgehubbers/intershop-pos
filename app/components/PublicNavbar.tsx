// app/components/PublicNavbar.tsx

import { Link } from "react-router";

export function PublicNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg font-bold">IS</span>
            </div>
            <span className="text-xl font-bold text-gray-900">InterShop</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Inicio
            </Link>
            <Link to="/#features" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Características
            </Link>
            <Link to="/#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Precios
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Iniciar Sesión
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}