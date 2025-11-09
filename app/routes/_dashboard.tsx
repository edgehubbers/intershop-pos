import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { supabase } from "../lib/supabase.client";
import { AppSidebar } from "../components/Sidebar";
import { SidebarProvider } from "../components/ui/sidebar";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
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
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-mobile": "18rem",
        } as React.CSSProperties
      }
    >
      {/* Estructura simple: Sidebar + main; sin header arriba */}
      <AppSidebar userEmail={userEmail} />
      <main className="min-h-screen flex-1 bg-gray-50">
        {/* Usa tu clase .page para padding consistente */}
        <div className="page">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
}
