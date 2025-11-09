// app/routes.ts
import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),

  // PÚBLICAS
  route("mision-vision", "routes/mision_vision.tsx"),
  route("sobre-nosotros", "routes/sobre_nosotros.tsx"),
  route("preguntas-frecuentes", "routes/preguntas_frecuentes.tsx"),
  route("pricing", "routes/pricing.tsx"),

  // E-COMMERCE
  route("tienda", "routes/tienda.tsx"),
  route("tienda/checkout", "routes/tienda.checkout.tsx"),
  route("tienda/pedidos", "routes/tienda.pedidos.tsx"),

  // DASHBOARD
  layout("routes/_dashboard.tsx", [
    route("dashboard", "routes/dashboard/index.tsx"),
    route("dashboard/pos", "routes/dashboard/pos.tsx"),
    route("dashboard/products", "routes/dashboard/products.tsx"),
    route("dashboard/sales", "routes/dashboard/sales.tsx"),
    route("dashboard/chatbot", "routes/dashboard/chatbot.tsx"),
    route("dashboard/analytics", "routes/dashboard/analytics.tsx"),
    route("dashboard/tienda-online", "routes/dashboard/tienda-online.tsx"),
  ]),

  route("op", "routes/pruebas_api/op.tsx"),
] satisfies RouteConfig;
