// app/routes/home.tsx

import type { Route } from "./+types/home";
import { PublicNavbar } from "../components/PublicNavbar";

export default function Home() {
  return (
    <div className="min-h-screen">
      <PublicNavbar />

      <div className="h-[140px] md:h-[180px]" />

      <main className="px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
            InterShop POS
          </h1>
          <p className="text-xl text-gray-600">
            Sistema de Punto de Venta simple, rápido y seguro.
          </p>
        </div>
      </main>
    </div>
  );
}