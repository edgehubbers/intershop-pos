// app/routes.ts

import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  
  layout("routes/_dashboard.tsx", [
    route("dashboard", "routes/dashboard/index.tsx"),
    route("dashboard/pos", "routes/dashboard/pos.tsx"),
    route("dashboard/products", "routes/dashboard/products.tsx"),
    route("dashboard/sales", "routes/dashboard/sales.tsx"),
    route("dashboard/chatbot", "routes/dashboard/chatbot.tsx"),

  ]),

  route("op", "routes/op.tsx"),
  route("db", "routes/db.tsx"),
] satisfies RouteConfig;