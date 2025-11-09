// vite.config.ts
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: { host: "localhost", port: 5173, strictPort: true, open: true },
  preview: { port: 4173, strictPort: true },
  base: "/",
  build: { outDir: "dist" },
  // Si te molesta el overlay:
  // server: { hmr: { overlay: false } }
});
