// server/lib/index.ts

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { getSupabaseServer } from './supabase';
import {
  createPaymentRequest,
  getIncomingPaymentStatus,
  completeIncomingPayment
} from './open-payments';
import { resolveWallet } from './wallet';
import { ChatbotWithAI } from './chatbot-ai';

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================
// HEALTH CHECK
// ============================
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

// ============================
// CHATBOT
// ============================
app.post('/api/chatbot', async (req: Request, res: Response) => {
  try {
    console.log('🤖 Chatbot request received');
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'El campo "message" es requerido' });
    }

    const bot = new ChatbotWithAI();
    const response = await bot.processMessage(message, history);

    res.json({ response });
  } catch (error: any) {
    console.error('❌ /api/chatbot error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================
// WALLET / PAYMENTS
// ============================
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

app.get('/api/productos', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.from('productos').select('*').order('nombre');
    if (error) {
      console.error('❌ Supabase /api/productos:', error);
      return res.status(500).json({ message: error.message, code: error.code });
    }
    console.log(`✅ /api/productos -> ${data?.length ?? 0} filas`);
    res.json({ productos: data ?? [] });
  } catch (e: any) {
    console.error('❌ Handler /api/productos:', e);
    res.status(500).json({ message: e?.message ?? 'Error desconocido' });
  }
});

app.post('/api/create-payment', async (req: Request, res: Response) => {
  try {
    const { amount, description } = req.body as { amount: number; description: string };
    if (typeof amount !== 'number' || !isFinite(amount)) {
      return res.status(400).json({ message: 'amount inválido' });
    }
    const payment = await createPaymentRequest(amount, description ?? '');
    res.status(201).json({ success: true, payment });
  } catch (e: any) {
    console.error('❌ Handler /api/create-payment:', e);
    res.status(500).json({ success: false, message: e?.message ?? 'Error desconocido' });
  }
});

app.post('/api/payments/confirm', async (req: Request, res: Response) => {
  try {
    const {
      receiver,
      expectedMinor,
      assetCode,
      assetScale,
      metodo_pago = 'open-payments',
      id_cliente = null,
      customerWallet = null
    } = req.body as {
      receiver: string;
      expectedMinor: number;
      assetCode: string;
      assetScale: number;
      metodo_pago?: string;
      id_cliente?: number | null;
      customerWallet?: string | null;
    };

    if (!receiver || typeof expectedMinor !== 'number' || !assetCode || typeof assetScale !== 'number') {
      return res.status(400).json({ paid: false, message: 'Payload inválido' });
    }

    const incoming = await getIncomingPaymentStatus(receiver);
    const receivedMinor = parseInt(incoming?.receivedAmount?.value ?? '0', 10);
    const expected = expectedMinor;
    const paid = receivedMinor >= expected;

    if (!paid) {
      return res.json({
        paid: false,
        receivedMinor,
        expectedMinor: expected,
        completed: !!incoming?.completed
      });
    }

    if (!incoming?.completed) {
      try { await completeIncomingPayment(receiver); } catch (err) { console.warn('⚠️ completeIncomingPayment:', err); }
    }

    const supabase = getSupabaseServer();
    const totalNumber = Number((expected / Math.pow(10, assetScale)).toFixed(2));
    const metodo = customerWallet
      ? `${metodo_pago} (payer: ${customerWallet})`
      : metodo_pago;

    const { data, error } = await supabase
      .from('ventas')
      .insert({
        total: totalNumber,
        metodo_pago: metodo,
        id_cliente: id_cliente ?? null
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Insert ventas:', error);
      return res.status(200).json({
        paid: true,
        ventaId: null,
        receivedMinor,
        expectedMinor: expected,
        dbError: { code: error.code, message: error.message }
      });
    }

    return res.json({
      paid: true,
      ventaId: data?.id ?? null,
      receivedMinor,
      expectedMinor: expected
    });
  } catch (e: any) {
    console.error('❌ /api/payments/confirm:', e);
    res.status(500).json({ paid: false, message: e?.message ?? 'Error confirmando pago' });
  }
});

// ============================
// ERROR HANDLERS
// ============================
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 SERVIDOR BACKEND INICIADO');
  console.log('='.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chatbot: http://localhost:${PORT}/api/chatbot`);
  console.log(`💳 Payments: http://localhost:${PORT}/api/create-payment`);
  console.log('\n📦 Servicios:');
  console.log(`   ✅ Supabase: ${process.env.SUPABASE_URL ? 'Configurado' : '❌ Falta'}`);
  console.log(`   ✅ Claude API: ${process.env.ANTHROPIC_API_KEY ? 'Configurado' : '❌ Falta'}`);
  console.log(`   ✅ Open Payments: ${process.env.WALLET_ADDRESS_URL ? 'Configurado' : '❌ Falta'}`);
  console.log('='.repeat(60) + '\n');
});