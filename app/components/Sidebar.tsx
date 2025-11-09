import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { supabase } from "../lib/supabase.client";
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarRail,
} from "./ui/sidebar";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ReceiptText,
  Bot,
  LineChart,
  LogOut,
  CircleUserRound,
  Store,
} from "lucide-react";

type AppSidebarProps = {
  userEmail?: string | null;
};

export function AppSidebar({ userEmail }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

const menuItems = [
  { path: "/dashboard",            label: "Inicio",         icon: LayoutDashboard },
  { path: "/dashboard/pos",        label: "Punto de Venta", icon: ShoppingCart   },
  { path: "/dashboard/products",   label: "Productos",      icon: Package        },
  { path: "/dashboard/sales",      label: "Ventas",         icon: ReceiptText    },
  { path: "/dashboard/chatbot",    label: "Chatbot",        icon: Bot            },
  { path: "/dashboard/analytics",  label: "Analytics",      icon: LineChart      },
  { path: "/dashboard/tienda-online", label: "Tienda Online", icon: Store       }, // 👈 NUEVO
];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <UISidebar collapsible="icon" variant="sidebar" side="left">
      {/* Cabecera simple con logo/brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/dashboard">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
                  IS
                </div>
                <span className="truncate font-semibold">InterShop</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Sección de navegación */}
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive(item.path)}>
                      <Link to={item.path}>
                        <Icon className="h-4 w-4" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer con info de usuario + cerrar sesión */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3"
                title="Cerrar sesión"
              >
                <CircleUserRound className="h-5 w-5" />
                <div className="min-w-0 text-left">
                  <div className="truncate text-sm font-medium">
                    {userEmail ?? "Usuario"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Cerrar sesión
                  </div>
                </div>
                <LogOut className="ml-auto h-4 w-4 opacity-70" />
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Rail para colapsar/expandir al pasar el mouse/clic */}
      <SidebarRail />
    </UISidebar>
  );
}

// Si en algún lugar sigues importando { Sidebar } desde este archivo,
// este alias evita errores de importación antiguos.
// export { AppSidebar as Sidebar };
