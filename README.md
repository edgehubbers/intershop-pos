Intershop POS

Punto de venta (POS) con React Router 7 + Vite + Tailwind, backend Node/Express, base de datos en Supabase y cobros con Open Payments (Interledger).

Demo login (opcional):
correo: emi@interledger.com
contraseña: 123456
También puedes registrarte y usar tu propia cuenta.

⚙️ Requisitos

Node.js ≥ 18 (recomendado 20+)

npm (o pnpm/yarn si prefieres, aquí usamos npm)

Una cuenta/proyecto en Supabase (URL + Anon Key)

Una wallet Open Payments de prueba (Interledger Testnet) para el comercio y fondos en tu wallet del cliente para hacer pagos

📁 Estructura (resumen)
app/
  components/
    animation/ (TextType, BlurText, etc.)
    ui/
  lib/ (open-payments.server.ts, supabase.*)
  routes/ (dashboard, tienda, auth, etc.)
public/
server/
  lib/ (index.ts y rutas/servicios del backend Express)

🧩 Instalación
npm install

▶️ Ejecutar en local

Arranca frontend + backend juntos (modo dev con HMR):

npm run dev:all


Frontend: http://localhost:5173

Backend: http://localhost:3001

Scripts disponibles:

npm run dev – solo React Router (front)

npm run dev:server – solo backend Express (con tsx)

npm run dev:all – ambos en paralelo (recomendado)

npm run build – build de producción (SSR + cliente)

npm run start – sirve el build SSR con @react-router/serve

npm run typecheck – tipos TS

🔑 Acceso a la app

Ve a http://localhost:5173/login

Inicia sesión con:

emi@interledger.com
 / 123456 (demo)

o regístrate con tu correo

Entra al Punto de Venta (POS) y agrega productos al carrito.

💸 Flujo de pago (Interledger / Open Payments)

Desde el POS, al finalizar la compra se genera un Incoming Payment (receiver URL) en la cuenta del comercio.

En tu wallet de Interledger (cliente) abre Send y pega ese receiver en “Wallet address or Incoming payment”.

Autoriza el pago (asegúrate de tener fondos).

El backend hará polling al incoming y, al recibir los fondos esperados, marcará la venta como pagada y la registrará en la base de datos.

La sección de análisis/IA puede usar estos datos para apoyar decisiones del negocio.

Si una wallet de prueba te redirige a /no-access?... con el error “A 'cache-control' header is missing or empty”, este proyecto ya incluye un finish callback en el backend que devuelve Cache-Control: no-store (requisito de seguridad). Asegúrate de tener API_BASE/FRONTEND_URL correctos.

🗃️ Esquema de Base de Datos (Supabase)

Tablas principales:

productos, categorias, productos_online

clientes

pedidos_online + detalle_pedido (checkout web)

ventas + detalle_venta (POS)

store_settings

Relaciones clave:

detalle_pedido.id_pedido → pedidos_online.id

detalle_pedido.id_producto → productos.id

detalle_venta.id_venta → ventas.id

detalle_venta.id_producto → productos.id

pedidos_online.id_cliente → clientes.id

pedidos_online.receiver y ventas.receiver guardan el receiver; payer_wallet guarda la wallet del pagador.

🔌 API principal (backend)

GET /api/store/products
Lista de productos disponibles públicamente.

POST /api/tienda/pedido
Crea pedido online (detalle incluido).

POST /api/op/checkout/start
Crea incoming payment del comercio y arranca grant interactivo del cliente (GNAP).
Devuelve redirect (wallet), continue y payment.

POST /api/op/checkout/continue
Finaliza el grant con interact_ref, crea Quote y Outgoing Payment.

POST /api/tienda/confirmar-pago
Polling del incoming para confirmar la venta y marcarla como pagada.

Además, existe /op/callback (GET) en el backend como finish de GNAP con Cache-Control: no-store que redirige al front (/tienda/callback).

🚀 Build y despliegue
Build local
npm run build





