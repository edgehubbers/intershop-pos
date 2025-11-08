// app/routes/_dashboard.tsx

import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { supabase } from "../lib/supabase.client";
import { Sidebar } from "../components/Sidebar";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // ✅ Tipado explícito de la respuesta de getUser()
    supabase.auth.getUser().then(
      (response: {
        data: { user: { email?: string } | null };
        error: Error | null;
      }) => {
        const { data, error } = response;

        if (error || !data.user) {
          navigate("/login");
        } else {
          setUserEmail(data.user.email ?? null);
          setLoading(false);
        }
      }
    );
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{userEmail}</span>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {userEmail?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
