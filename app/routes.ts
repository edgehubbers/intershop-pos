import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("op", "routes/op.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("db", "routes/db.tsx"), 
  route("deasboard", "routes/dashboard.tsx")

] satisfies RouteConfig;
