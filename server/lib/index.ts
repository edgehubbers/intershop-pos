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

// Bootstrap GNAP creds desde .env
(function bootstrapOpenPaymentsCreds() {
  try {
    const walletAddressUrl = (process.env.WALLET_ADDRESS_URL || '').trim();
    const keyId = (process.env.OP_KEY_ID || process.env.KEY_ID || '').trim();

    let privateKeyPem = (process.env.OP_PRIVATE_KEY_PEM || '').replace(/\r\n/g, '\n').trim();
    const b64 = (process.env.OPEN_PAYMENTS_PRIVATE_KEY_B64 || '').trim();
    
    if (!privateKeyPem && b64) {
      try {
        privateKeyPem = Buffer.from(b64, 'base64').toString('utf8').replace(/\r\n/g, '\n').trim();
        console.log('✅ Clave privada convertida desde base64');
      } catch (e) {
        console.warn('⚠️ Error convirtiendo base64 a PEM:', (e as any)?.message);
      }
    }

    if (walletAddressUrl && keyId && privateKeyPem) {
      setRuntimeOPCreds({ walletAddressUrl, keyId, privateKeyPem });
      console.log('✅ GNAP creds inicializadas desde .env');
      console.log('   Wallet:', walletAddressUrl);
      console.log('   Key ID:', keyId);
      console.log('   Private Key:', privateKeyPem.substring(0, 50) + '...');
    } else {
      console.warn('⚠️ GNAP creds incompletas en .env');
      console.warn('   WALLET_ADDRESS_URL:', walletAddressUrl ? '✓' : '✗');
      console.warn('   KEY_ID:', keyId ? '✓' : '✗');
      console.warn('   Private Key:', privateKeyPem ? '✓' : '✗');
    }
  } catch (e) {
    console.warn('⚠️ No se pudieron inicializar GNAP creds desde .env:', (e as any)?.message);
  }
})();

// Logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/* =======================================================================
   ⚠️ DEV ONLY: cargar credenciales GNAP en tiempo de ejecución
   ======================================================================= */
app.post('/api/op/runtime-keys', (req: Request, res: Response) => {
  try {
    const { walletAddressUrl, keyId, privateKeyPem } = req.body || {};
    if (!walletAddressUrl || !keyId || !privateKeyPem) {
      return res.status(400).json({ ok: false, message: 'walletAddressUrl, keyId y privateKeyPem son requeridos' });
    }
    const pem = String(privateKeyPem).replace(/\r\n/g, '\n');
    setRuntimeOPCreds({ walletAddressUrl: String(walletAddressUrl), keyId: String(keyId), privateKeyPem: pem });
    console.log('✅ Runtime credentials actualizadas via API');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || 'Error' });
  }
});

/* =======================================================================
   Diagnóstico del grant del comercio
   ======================================================================= */
app.get('/api/op/diag/merchant', async (_req: Request, res: Response) => {
  try {
    console.log('\n🔍 Iniciando diagnóstico del comercio...\n');
    
    const { client, merchant } = await getMerchantClient();
    console.log('✅ Cliente del comercio creado');
    console.log('   Wallet:', merchant.walletAddressUrl);
    console.log('   Resource Server:', merchant.resourceServer);
    console.log('   Auth Server:', merchant.authServer);
    
    const token = await requestMerchantAccessToken(client, merchant);
    console.log('✅ Access token obtenido');
    
    // Crear incoming payment de prueba
    const testAmount = 100;
    const incoming = await client.incomingPayment.create(
      { url: merchant.resourceServer, accessToken: token },
      {
        walletAddress: merchant.walletAddressUrl,
        incomingAmount: {
          value: String(testAmount),
          assetCode: merchant.assetCode,
          assetScale: merchant.assetScale,
        },
        metadata: { description: 'Test diagnóstico' },
      }
    );
    console.log('✅ Incoming payment de prueba creado:', incoming.id);
    
    // Intentar leer el incoming payment (aquí suele fallar con 403)
    try {
      const { incoming: read } = await getIncomingWithMerchantAuth(incoming.id);
      console.log('✅ Incoming payment leído exitosamente');
      
      res.json({ 
        ok: true, 
        merchant, 
        gotAccessToken: !!token,
        testIncomingPayment: incoming.id,
        canReadIncoming: true,
        message: '✅ Todas las operaciones exitosas. Credenciales correctas.'
      });
    } catch (readError: any) {
      console.error('❌ Error leyendo incoming payment:', readError.message);
      res.status(403).json({
        ok: false,
        merchant,
        gotAccessToken: !!token,
        testIncomingPayment: incoming.id,
        canReadIncoming: false,
        error: readError.message,
        diagnosis: {
          problem: 'Error 403 al leer incoming payment',
          cause: 'El KEY_ID no tiene permisos de lectura (incoming-payment:read)',
          solution: 'Ve a https://rafiki.money/ y asegúrate de que tu KEY_ID tenga estos permisos: incoming-payment:create, incoming-payment:read, incoming-payment:complete, incoming-payment:list'
        }
      });
    }
  } catch (e: any) {
    console.error('❌ Error en diagnóstico:', e.message);
    res.status(500).json({ 
      ok: false, 
      message: e?.message || 'error',
      stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    });
  }
});

// Verifica que el receiver es accesible
app.get('/api/op/diag/receiver', async (req: Request, res: Response) => {
  try {
    const receiver = String(req.query.url || '').trim();
    if (!receiver) {
      return res.status(400).json({ ok: false, message: 'Parámetro url requerido' });
    }
    if (!/^https?:\/\//i.test(receiver)) {
      return res.status(400).json({
        ok: false,
        message: 'Parámetro "url" debe ser la URL completa del incoming-payment (https://...)'
      });
    }
    
    console.log('🔍 Verificando receiver:', receiver);
    const { incoming } = await getIncomingWithMerchantAuth(receiver);
    console.log('✅ Receiver accesible');
    
    res.json({ ok: true, incoming });
  } catch (e: any) {
    console.error('❌ Error accediendo a receiver:', e.message);
    res.status(403).json({ 
      ok: false, 
      message: e?.message || 'Forbidden',
      diagnosis: 'El receiver no es accesible con tus credenciales actuales'
    });
  }
});

// Monta tienda
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

// Chatbot
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

// Wallet resolver
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
  res.status(500).json({ 
    error: 'Error interno del servidor', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Start
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 SERVIDOR BACKEND INICIADO');
  console.log('='.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔍 Diagnóstico: GET  http://localhost:${PORT}/api/op/diag/merchant`);
  console.log(`🛍️ Tienda: GET  /api/store/products`);
  console.log(`💳 Payments: POST /api/op/checkout/start`);
  console.log('='.repeat(60) + '\n');
});