Intershop

💳🌍 International-ready POS over Open Payments (Interledger) + 🤖 Claude Copilot grounded in Supabase.

🇺🇸 Overview

Intershop is a modern Point-of-Sale that helps businesses accept international transactions using Interledger’s Open Payments API. Each checkout generates an Incoming Payment (receiver), settles (near) real time, and is stored in Supabase (Postgres).
On top, a Claude-powered business copilot analyzes sales, revenue/expenses, and inventory to deliver evidence-based insights and actionable recommendations (reorders, discount plans, margin protection).

One-liner: Intershop = POS + Open Payments + Claude, all grounded in Supabase.

✨ Features

🌐 Open Payments (Interledger) — Programmable, cross-border payments via Incoming Payments (receivers).

⚡ Near real-time settlement — We confirm and complete the incoming payment when the expected amount is received.

🧠 Claude Copilot — Natural-language Q&A with evidence from your Supabase data (sales, stock, margins).

🔐 Security by design — GNAP scopes kept minimal; strict CORS; optional backend finish with Cache-Control: no-store.

🗃️ Supabase — Auth + Postgres + (optional) RLS for production-grade access control.

🧩 Stack — React Router 7 + Vite + Tailwind (frontend) · Node/Express + TypeScript (backend).

📁 Project Structure (high level)
intershop-pos/
├─ app/                      # Frontend (React Router 7 + Vite + Tailwind)
│  ├─ components/            # UI & animations (SSR-safe)
│  ├─ lib/                   # supabase client, helpers
│  └─ routes/                # pages: login, register, tienda, tienda.checkout, etc.
├─ public/                   # static assets
├─ server/
│  └─ lib/                   # Backend (Express + TypeScript)
│     ├─ web-store.ts        # store, checkout, Open Payments GNAP routes
│     ├─ open-payments-gnap.ts
│     ├─ open-payments.ts
│     ├─ supabase.ts
│     └─ index.ts            # server entry (mounts routes)
├─ react-router.config.ts    # SSR-capable build
├─ vite.config.ts
├─ tailwind.config.cjs
└─ package.json


Your build output confirms routes like tienda, tienda.checkout, pos, products, sales, etc., and includes a chatbot bundle (the API route name can be /api/ai/ask or whichever you implemented).

🔑 Demo Access

Email: emi@interledger.com

Password: 123456

Or register with your email (Supabase Auth).

🚀 Quick Start
Requirements

Node.js 18+ (20+ recommended)

A Supabase project (URL + keys)

Interledger test wallet for the merchant, and a client wallet with funds (testnet)

Install
npm install

Run locally
npm run dev:all
# Frontend: http://localhost:5173
# Backend : http://localhost:3001

Scripts (from package.json)

dev — React Router dev (frontend)

dev:server — Express dev (backend)

dev:all — run both (recommended)

build — React Router build (SSR + client)

start — serve SSR (react-router-serve ./build/server/index.js)

typecheck — typegen + TypeScript

🧪 User Flow (Open Payments)

Login/Register (Supabase Auth).

Add products in POS / Online Store.

Checkout → backend creates a receiver (Incoming Payment) for the merchant.

Open your Interledger wallet, go to Send, paste the receiver into “Wallet address or Incoming payment”.

Authorize (ensure you have funds).

Backend confirms received >= expected, completes the incoming payment, and records the sale (updates stock).

🔌 API (confirmed from your code)

Store / POS

GET /api/store/products

GET /api/store/settings

PUT /api/store/settings

POST /api/tienda/cliente (upsert by email)

POST /api/tienda/pedido (create order + details)

GET /api/tienda/productos (alias → /api/store/products)

Open Payments (GNAP)

POST /api/op/checkout/start (create Incoming Payment + start interactive grant)

POST /api/op/checkout/continue (finalize grant → create Quote → create Outgoing Payment)

POST /api/tienda/confirmar-pago (poll & complete when received >= expected, persist sale)

Generic (optional, also present in your code)

POST /api/create-payment (simple flow without GNAP)

POST /api/payments/confirm (generic POS confirm with auth + fallback)

Claude Copilot (optional)

Suggested endpoint: POST /api/ai/ask
Body: { question, range? } → server queries Supabase (aggregates), sends compact JSON evidence to Claude, returns insights + actions.
(If you used another route name, keep that one.)

🗃️ Data Model (Supabase)

Main tables (from your schema):

productos, categorias, productos_online

clientes (customer profile; identity is handled by Supabase Auth)

pedidos_online, detalle_pedido (web checkout)

ventas, detalle_venta (final sale / POS)

store_settings

Data flow

Checkout: upsert clientes → create pedidos_online + detalle_pedido

On payment confirmation: complete incoming → create ventas + detalle_venta → mark pedidos_online.estado = 'pagado' → decrement stock

Auth note: with Supabase Auth, avoid storing your own password hashes in public tables; rely on auth.users and sync only profile/metadata in clientes.

🧾 Environment Variables
Frontend (Vite)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3001

Backend (Express)
# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase (backend)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key   # or SERVICE_ROLE if you enforce RLS

# Open Payments (merchant)
WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/your-merchant
OP_KEY_ID=your-key-id
OP_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# (option) OPEN_PAYMENTS_PRIVATE_KEY_B64=...

# Storage
PRODUCTS_BUCKET=product-images

# Claude (Copilot, optional)
ANTHROPIC_API_KEY=your-claude-api-key


Never commit private keys to the repo.

🔐 Security Essentials

GNAP scopes kept minimal (e.g., incoming-payment:create|read|complete|list).

Strict confirmation: do not complete until received >= expected.

Supabase Auth for identity; RLS recommended in production.

Finish callback and caching:
Some wallets require Cache-Control: no-store on the finish response. You can:

Serve your finish via backend (recommended):

// Express finish (backend)
app.get('/op/callback', (req, res) => {
  res.set({
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'"
  })
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
  const qs = new URLSearchParams(req.query as any).toString()
  res.status(200).send(`<!doctype html><meta charset="utf-8">

<title>Back…</title><script>location.replace('${FRONTEND_URL}/tienda/callback?op=ready&${qs}')</script>`) }) ``` - Or, if you keep finish in the frontend route, configure your host to add `Cache-Control: no-store` headers for that path.
☁️ Deployment
Frontend → Netlify (simple)

Build command: react-router build

Publish directory: build/client

Env vars: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

(You can keep backend as a separate Node app—Railway/Render/Fly/VM—with CORS allowing your Netlify domain.)

Backend → Any Node host

Run your Express server with the env vars above.
Enable CORS for http://localhost:5173 and your Netlify site.

🧰 Troubleshooting

Wallet says “cache-control missing/empty” on finish: serve finish from backend with Cache-Control: no-store (snippet above), or configure your host to add the header on the front route.

403 reading/confirming receiver: the merchant GNAP credentials don’t match the wallet that created that receiver. Use the same WALLET_ADDRESS_URL/OP_KEY_ID/OP_PRIVATE_KEY_PEM.

Tailwind “ambiguous class” for ease-[...]: use ease-in-out or escape as ease-\[cubic-bezier(0.4,0,0.2,1)\].

GSAP + SSR: import GSAP on the client only (dynamic import in animation components).

🎯 KPIs (value)

⏱️ Settlement time per sale

💸 AOV and margin per category

🏆 Top-5 products by rotation/revenue

🔁 Repeat purchase by customer/cohorts

🤖 Copilot action-rate (answers that led to actions)

🎬 5-Minute Demo Script

What/Why (30s) — Intershop = POS + Open Payments + Claude (Supabase).

Login (30s) — emi@interledger.com / 123456.

POS/Store (1m) — Add 2–3 items.

Checkout (1m) — Generate receiver, wallet Send, paste receiver, authorize.

Confirmation (1m) — Incoming completes, sale recorded, stock updated.

Copilot (1m) — Ask: “Top 10 last 30 days” / “What to reorder this week?” Close with security & scale.

📄 License

MIT (or the license you choose).

Intershop

💳🌍 Punto de venta para pagos internacionales con Open Payments (Interledger) + 🤖 Copiloto Claude anclado a Supabase.

🇪🇸 Descripción

Intershop es un punto de venta que permite aceptar transacciones internacionales usando la API Open Payments de Interledger. Cada compra genera un Incoming Payment (receiver), se liquida casi en tiempo real y se registra en Supabase (Postgres).
Encima de esos datos, un copiloto de negocio con Claude analiza ventas, ingresos/egresos e inventario para entregar insights con evidencia y recomendaciones accionables (reabastecer, descuentos, protección de margen).

En una frase: Intershop = POS + Open Payments + Claude, todo sobre Supabase.

✨ Características

🌐 Open Payments (Interledger) — Pagos programables y transfronterizos con receivers.

⚡ Liquidación casi en tiempo real — Confirmamos y completamos cuando received >= expected.

🧠 Copiloto Claude — Preguntas en lenguaje natural con evidencias de tus datos en Supabase.

🔐 Seguridad práctica — Scopes GNAP mínimos; CORS estricto; finish opcional en backend con Cache-Control: no-store.

🗃️ Supabase — Auth + Postgres + (opcional) RLS para producción.

🧩 Stack — React Router 7 + Vite + Tailwind (frontend) · Node/Express + TypeScript (backend).

📁 Estructura del Proyecto (alto nivel)
intershop-pos/
├─ app/                      # Frontend (React Router 7 + Vite + Tailwind)
│  ├─ components/            # UI y animaciones (compatibles con SSR)
│  ├─ lib/                   # supabase client, helpers
│  └─ routes/                # páginas: login, register, tienda, tienda.checkout, etc.
├─ public/
├─ server/
│  └─ lib/                   # Backend (Express + TypeScript)
│     ├─ web-store.ts        # store, checkout, rutas Open Payments GNAP
│     ├─ open-payments-gnap.ts
│     ├─ open-payments.ts
│     ├─ supabase.ts
│     └─ index.ts            # entrada del servidor (monta rutas)
├─ react-router.config.ts
├─ vite.config.ts
├─ tailwind.config.cjs
└─ package.json

🔑 Acceso de Demo

Correo: emi@interledger.com

Contraseña: 123456

O regístrate con tu correo (Supabase Auth).

🚀 Inicio Rápido
Requisitos

Node.js 18+ (recomendado 20+)

Proyecto en Supabase (URL + llaves)

Wallet Interledger de comercio, y wallet de cliente con fondos (testnet)

Instalar
npm install

Ejecutar en local
npm run dev:all
# Frontend: http://localhost:5173
# Backend : http://localhost:3001

Scripts

dev (solo front) · dev:server (solo back) · dev:all (ambos)

build (SSR + cliente) · start (serve SSR) · typecheck

🧪 Flujo de Usuario (Open Payments)

Login/Registro (Supabase Auth).

Agrega productos en POS / Tienda.

Checkout → el backend crea un receiver (Incoming Payment) del comercio.

Abre tu wallet Interledger, ve a Send y pega el receiver en “Wallet address or Incoming payment”.

Autoriza (asegúrate de tener fondos).

El backend confirma received >= expected, completa el incoming y registra la venta (actualiza stock).

🔌 API (confirmada por tu código)

Store / POS

GET /api/store/products

GET /api/store/settings

PUT /api/store/settings

POST /api/tienda/cliente

POST /api/tienda/pedido

GET /api/tienda/productos (alias → /api/store/products)

Open Payments (GNAP)

POST /api/op/checkout/start

POST /api/op/checkout/continue

POST /api/tienda/confirmar-pago

Genérico (opcional, también presente)

POST /api/create-payment

POST /api/payments/confirm

Copiloto Claude (opcional)

Endpoint sugerido: POST /api/ai/ask
Body: { question, range? } → el servidor consulta Supabase (agregados), envía evidencia JSON compacta a Claude y devuelve insights + acciones.
(Si usaste otro nombre de ruta, conserva el tuyo.)

🗃️ Modelo de Datos (Supabase)

Tablas principales (según tu esquema):

productos, categorias, productos_online

clientes (perfil; la identidad la gestiona Supabase Auth)

pedidos_online, detalle_pedido

ventas, detalle_venta

store_settings

Flujo de datos

Checkout: upsert clientes → pedidos_online + detalle_pedido

Confirmación de pago: completar incoming → crear ventas + detalle_venta → pedidos_online.estado = 'pagado' → decrementar stock

Nota de Auth: con Supabase Auth, evita guardar password_hash propio en tablas públicas; usa auth.users y sincroniza solo perfil/metadata en clientes.

🧾 Variables de Entorno
Frontend (Vite)
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_API_URL=http://localhost:3001

Backend (Express)
# Servidor
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Supabase (backend)
SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_supabase_anon_key   # o SERVICE_ROLE si aplicas RLS

# Open Payments (comercio)
WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/tu-merchant
OP_KEY_ID=tu-key-id
OP_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# opcional: OPEN_PAYMENTS_PRIVATE_KEY_B64=...

# Storage
PRODUCTS_BUCKET=product-images

# Claude (Copiloto, opcional)
ANTHROPIC_API_KEY=tu-claude-api-key


Nunca subas llaves privadas al repositorio.

🔐 Seguridad (puntos clave)

Scopes GNAP mínimos (crear/leer/completar/listar lo necesario).

Confirmación estricta: no completar hasta received >= expected.

Supabase Auth para identidad; RLS recomendado en producción.

Finish y caché:
Algunas wallets exigen Cache-Control: no-store en la respuesta de finish. Opciones:

Backend finish (recomendado) con cabeceras no-store (snippet en la sección en inglés).

O mantener finish en el front y configurar tu hosting para añadir Cache-Control: no-store en esa ruta.

☁️ Despliegue
Frontend → Netlify (simple)

Build command: react-router build

Publish directory: build/client

Env vars: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

Backend → Cualquier host Node

Ejecuta tu servidor Express con las variables de entorno y CORS habilitado para tu dominio de Netlify y http://localhost:5173.

🧰 Problemas frecuentes

“cache-control missing/empty” en finish: sirve el finish desde backend con Cache-Control: no-store o configura el hosting del front para añadir esa cabecera.

403 al leer/confirmar un receiver: las credenciales GNAP del comercio no coinciden con la wallet que creó ese receiver (usa la misma WALLET_ADDRESS_URL/OP_KEY_ID/OP_PRIVATE_KEY_PEM).

Tailwind “ambiguous class”: usa ease-in-out o ease-\[cubic-bezier(0.4,0,0.2,1)\].

GSAP + SSR: importa GSAP solo en cliente (import dinámico).

🎯 KPIs (valor)

⏱️ Tiempo de liquidación por venta

💸 Ticket promedio y margen por categoría

🏆 Top-5 productos por rotación/ingreso

🔁 Recompra por cliente/cohortes
¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡
# ================================
# Open Payments (COMERCIO)
# ================================
WALLET_ADDRESS_URL=https://ilp.interledger-test.dev/mishop
OP_KEY_ID=87ae976c-2c3b-4584-8d89-e614252a7c99
KEY_ID=87ae976c-2c3b-4584-8d89-e614252a7c99

# Private Key PEM (Ed25519) en Base64
OPEN_PAYMENTS_PRIVATE_KEY_B64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUk4R1lkTlBycENDSUVCanR0dVBIUjIwWC80R3RmdkV5QWxKMFk1VlViakoKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQ==

# ================================
# Supabase
# ================================
SUPABASE_URL=https://minpnrzlqwzehzgqtfxv.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnBucnpscXd6ZWh6Z3F0Znh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTcxMzEsImV4cCI6MjA3ODEzMzEzMX0.xRd8Bfc12-lSSkYIZ5LjeiwBL-5QYpsgC3jQrVjuAD8

# ================================
# Claude API (Anthropic)
# ================================
#ANTHROPIC_API_KEY=...........................................................................................................................

# ================================
# Servidor Backend
# ================================
PORT=3001
NODE_ENV=development

# ================================
# Frontend (para CORS)
# ================================
#FRONTEND_URL=http://localhost:5173

# ================================
# Vite (Cliente)
# ================================
VITE_SUPABASE_URL=https://minpnrzlqwzehzgqtfxv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbnBucnpscXd6ZWh6Z3F0Znh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NTcxMzEsImV4cCI6MjA3ODEzMzEzMX0.xRd8Bfc12-lSSkYIZ5LjeiwBL-5QYpsgC3jQrVjuAD8
VITE_API_URL=http://localhost:3001

PRODUCTS_BUCKET=product-images
