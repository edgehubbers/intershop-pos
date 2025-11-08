import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "InterShop POS" },
    { name: "description", content: "Punto de venta con React Router" },
  ];
}

// Loader mínimo para manejar la petición GET a "/"
export async function loader({}: Route.LoaderArgs) {
  return null;
}

export default function Home() {
  return (
    <section className="container mx-auto p-6">
      <div className="rounded-2xl border p-8 text-center space-y-3">
        <h1 className="text-2xl font-semibold">Bienvenido a InterShop POS</h1>
        <p className="opacity-80">
          Esta es la página de inicio. Desde aquí iremos armando el sistema.
        </p>
        <div className="text-sm opacity-70">
          (Cuando lo indiqués, agregamos la ruta <code>/pos</code> y más módulos)
        </div>
        <div className="pt-2">
          <Link to="/" className="underline">
            Inicio
          </Link>
        </div>
      </div>
    </section>
  );
}
