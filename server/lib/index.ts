// server/lib/index.ts

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { getSupabaseServer } from './supabase';
import {
  createPaymentRequest,
  getIncomingPaymentStatus,
  completeIncomingPayment,
  getOpenPaymentsClient, // para leer assetCode/assetScale de la wallet
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

/**
 * Crea un incoming payment (receiver) y devuelve también assetCode, assetScale y expectedMinor,
 * que el POS usa para mostrar el monto exacto y hacer polling.
 */
app.post('/api/create-payment', async (req: Request, res: Response) => {
  try {
    const { amount, description } = req.body as { amount: number; description: string };
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount inválido' });
    }

    // 1) Crea el receiver (acepta ambos shapes: {paymentUrl} o {receiver})
    const created: any = await createPaymentRequest(numAmount, description ?? '');
    const receiverUrl: string =
      created?.receiver ?? created?.paymentUrl; // <-- corrige tu error TS

    if (!receiverUrl) {
      return res.status(500).json({ success: false, message: 'No se obtuvo receiver' });
    }

    // 2) Lee asset de la wallet (para assetScale/assetCode y expectedMinor)
    const client = await getOpenPaymentsClient();
    const wallet = await client.walletAddress.get({ url: process.env.WALLET_ADDRESS_URL! });

    const assetScale = wallet.assetScale ?? 2;
    const assetCode  = wallet.assetCode  ?? 'USD';
    const expectedMinor = Math.round(numAmount * Math.pow(10, assetScale));

    // 3) Respuesta compatible con el POS (receiver + asset info)
    res.status(201).json({
      success: true,
      payment: {
        receiver: receiverUrl,  // el POS usa .receiver
        amount: numAmount,
        description: description ?? '',
        assetCode,
        assetScale,
        expectedMinor,
      },
      walletAddressUrl: process.env.WALLET_ADDRESS_URL,
    });
  } catch (e: any) {
    console.error('❌ Handler /api/create-payment:', e);
    res.status(500).json({ success: false, message: e?.message ?? 'Error desconocido' });
  }
});

/**
 * Confirma el pago (cuando receivedMinor >= expectedMinor) y registra:
 * - ventas
 * - detalle_venta (ítems)
 * - decrementa stock por producto
 *
 * ⚠️ Guardamos payer_wallet SEPARADO de metodo_pago.
 */
app.post('/api/payments/confirm', async (req: Request, res: Response) => {
  try {
    const {
      receiver,
      expectedMinor,
      assetCode,
      assetScale,
      metodo_pago = 'open-payments',
      id_cliente = null,
      customerWallet = null,
      items = [],
    } = req.body as {
      receiver: string;
      expectedMinor: number;
      assetCode: string;
      assetScale: number;
      metodo_pago?: string;
      id_cliente?: number | null;
      customerWallet?: string | null; // wallet del cliente (payer)
      items?: Array<{ producto_id: number; cantidad: number; precio_unitario: number }>;
    };

    if (!receiver || typeof expectedMinor !== 'number' || !assetCode || typeof assetScale !== 'number') {
      return res.status(400).json({ paid: false, message: 'Payload inválido' });
    }

    // 1) Estado del receiver
    const incoming = await getIncomingPaymentStatus(receiver);
    const receivedMinor = parseInt(incoming?.receivedAmount?.value ?? '0', 10);
    const paid = receivedMinor >= Number(expectedMinor);

    if (!paid) {
      return res.json({
        paid: false,
        receivedMinor,
        expectedMinor,
        completed: !!incoming?.completed,
      });
    }

    // 2) Completar receiver (best-effort)
    if (!incoming?.completed) {
      try { await completeIncomingPayment(receiver); } catch (err) { console.warn('⚠️ completeIncomingPayment:', err); }
    }

    // 3) Persistir venta + detalle + stock
    const supabase = getSupabaseServer();

    const safeItems = Array.isArray(items) ? items : [];
    const totalFromItems = safeItems.reduce(
      (acc, it) => acc + Number(it.precio_unitario || 0) * Number(it.cantidad || 0),
      0
    );
    const fallbackTotal = Number((expectedMinor / Math.pow(10, assetScale)).toFixed(2));
    const totalNumber = Number((totalFromItems > 0 ? totalFromItems : fallbackTotal).toFixed(2));

    // ✅ método y payer separados
    const metodo = metodo_pago;
    const payer_wallet = customerWallet ?? null;

    // a) Insert venta (guardamos 'receiver' para idempotencia y 'payer_wallet' separado)
    const { data: ventaRow, error: ventaErr } = await supabase
      .from('ventas')
      .insert({
        total: totalNumber,
        metodo_pago: metodo,
        id_cliente: id_cliente ?? null,
        receiver,      // asegúrate de tener esta columna si la usas
        payer_wallet,  // nueva columna
      })
      .select('id')
      .single();

    if (ventaErr) {
      // Si es por duplicado de receiver (unique), trae el id existente (idempotencia)
      if ((ventaErr as any).code === '23505') {
        const { data: existing } = await supabase
          .from('ventas')
          .select('id')
          .eq('receiver', receiver)
          .single();

        return res.status(200).json({
          paid: true,
          ventaId: existing?.id ?? null,
          receivedMinor,
          expectedMinor,
        });
      }

      console.error('❌ Insert ventas:', ventaErr);
      return res.status(200).json({
        paid: true,
        ventaId: null,
        receivedMinor,
        expectedMinor,
        dbError: { code: (ventaErr as any).code, message: (ventaErr as any).message }
      });
    }

    const ventaId = Number(ventaRow.id);

    // b) Insert detalle si hay ítems
    if (safeItems.length) {
      const detalleRows = safeItems.map((it) => ({
        id_venta: ventaId,
        id_producto: Number(it.producto_id),
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        subtotal: Number((Number(it.cantidad) * Number(it.precio_unitario)).toFixed(2)),
      }));

      const { error: detErr } = await supabase.from('detalle_venta').insert(detalleRows);
      if (detErr) {
        console.error('❌ Insert detalle_venta:', detErr);
      }

      // c) Descontar stock (RPC si la tienes creada)
      await Promise.all(
        detalleRows.map((it) =>
          supabase.rpc('decrementar_stock', { p_id: it.id_producto, p_qty: it.cantidad })
        )
      ).catch((e) => console.warn('⚠️ decrementar_stock:', e));
    }

    return res.json({
      paid: true,
      ventaId,
      receivedMinor,
      expectedMinor,
      assetCode,
      assetScale,
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
