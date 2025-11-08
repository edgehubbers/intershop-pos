// app/routes.ts

import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Rutas públicas
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  
  // Rutas del dashboard (con layout usando _dashboard.tsx)
  layout("routes/_dashboard.tsx", [
    route("dashboard", "routes/dashboard/index.tsx"),
    route("dashboard/products", "routes/dashboard/products.tsx"),
    route("dashboard/sales", "routes/dashboard/sales.tsx"),
  ]),

  // Rutas de prueba
  route("op", "routes/op.tsx"),
  route("db", "routes/db.tsx"),
] satisfies RouteConfig;