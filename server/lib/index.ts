// server/lib/index.ts
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { getSupabaseServer } from './supabase';
import { resolveWallet } from './wallet';
import { ChatbotWithAI } from './chatbot-ai';
import { attachWebStore } from './web-store';
import { setRuntimeOPCreds, getMerchantClient, requestMerchantAccessToken, getIncomingWithMerchantAuth } from './open-payments-gnap';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Bootstrap GNAP creds desde .env (KEY_ID + OPEN_PAYMENTS_PRIVATE_KEY_B64 también sirven)
(function bootstrapOpenPaymentsCreds() {
  try {
    const walletAddressUrl = (process.env.WALLET_ADDRESS_URL || '').trim();
    const keyId = (process.env.OP_KEY_ID || process.env.KEY_ID || '').trim();

    let privateKeyPem = (process.env.OP_PRIVATE_KEY_PEM || '').replace(/\r\n/g, '\n').trim();
    const b64 = (process.env.OPEN_PAYMENTS_PRIVATE_KEY_B64 || '').trim();
    if (!privateKeyPem && b64) {
      try {
        privateKeyPem = Buffer.from(b64, 'base64').toString('utf8').replace(/\r\n/g, '\n').trim();
      } catch { /* noop */ }
    }

    if (walletAddressUrl && keyId && privateKeyPem) {
      setRuntimeOPCreds({ walletAddressUrl, keyId, privateKeyPem });
      console.log('✅ GNAP creds inicializadas desde .env');
    } else {
      console.warn('⚠️ GNAP creds incompletas en .env. Puedes usar /api/op/runtime-keys (solo DEV).');
    }
  } catch (e) {
    console.warn('⚠️ No se pudieron inicializar GNAP creds desde .env:', (e as any)?.message);
  }
})();

// Logging simple
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* =======================================================================
   DEV ONLY: cargar credenciales GNAP en tiempo de ejecución (DEL COMERCIO)
   ======================================================================= */
app.post('/api/op/runtime-keys', (req: Request, res: Response) => {
  try {
    const { walletAddressUrl, keyId, privateKeyPem } = req.body || {};
    if (!walletAddressUrl || !keyId || !privateKeyPem) {
      return res.status(400).json({ ok: false, message: 'walletAddressUrl, keyId y privateKeyPem son requeridos' });
    }
    const pem = String(privateKeyPem).replace(/\r\n/g, '\n');
    setRuntimeOPCreds({ walletAddressUrl: String(walletAddressUrl), keyId: String(keyId), privateKeyPem: pem });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Error' });
  }
});

/* =======================================================================
   Diagnóstico del grant del comercio + verificación de receiver
   ======================================================================= */
app.get('/api/op/diag/merchant', async (_req: Request, res: Response) => {
  try {
    const { client, merchant } = await getMerchantClient();
    const token = await requestMerchantAccessToken(client, merchant);
    res.json({ ok: true, merchant, gotAccessToken: !!token });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'error' });
  }
});

// Verifica que el receiver es accesible con las llaves actuales del COMERCIO
app.get('/api/op/diag/receiver', async (req: Request, res: Response) => {
  try {
    const receiver = String(req.query.url || '');
    if (!receiver) return res.status(400).json({ ok: false, message: 'Parámetro url requerido' });
    const { incoming } = await getIncomingWithMerchantAuth(receiver);
    res.json({ ok: true, incoming });
  } catch (e: any) {
    res.status(403).json({ ok: false, message: e?.message || 'Forbidden' });
  }
});

// Monta tienda (endpoints principales)
attachWebStore(app);

// Health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
    services: {
      supabase: !!process.env.SUPABASE_URL,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      openPayments: !!process.env.WALLET_ADDRESS_URL,
    },
  });
});

// Chatbot (opcional)
app.post('/api/chatbot', async (req: Request, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'El campo "message" es requerido' });
    const bot = new ChatbotWithAI();
    const response = await bot.processMessage(message, history);
    res.json({ response });
  } catch (error: any) {
    console.error('❌ /api/chatbot error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Utilidad POS “sencilla”
app.get('/api/wallet/resolve', async (req: Request, res: Response) => {
  try {
    const pointer = String(req.query.pointer ?? '').trim();
    if (!pointer) return res.status(400).json({ ok: false, message: 'pointer requerido' });
    const out = await resolveWallet(pointer);
    res.json({ ok: true, ...out });
  } catch (e: any) {
    res.status(400).json({ ok: false, message: e?.message ?? 'No se pudo resolver' });
  }
});

// 404 & error
app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// Start
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 SERVIDOR BACKEND INICIADO');
  console.log('='.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🛍️ Tienda: GET  /api/store/products | GET/PUT /api/store/settings | POST /api/tienda/cliente | POST /api/tienda/pedido | POST /api/tienda/confirmar-pago`);
  console.log(`💳 Payments: POST /api/create-payment | POST /api/payments/confirm`);
  console.log('='.repeat(60) + '\n');
});
