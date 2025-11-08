import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { getSupabaseServer } from './supabase';
import {
  createPaymentRequest,
  getIncomingPaymentStatus,
  completeIncomingPayment
} from './open-payments';
import { resolveWallet } from './wallet';


const app = express();
app.use(cors());
app.use(express.json());

// Validar/Resolver wallet del cliente
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

// Health
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: Date.now() });
});

// Productos
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

// Crear cobro (Receiver)
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

/**
 * Confirma si un receiver ya recibió el monto esperado.
 * Si está pagado: intenta COMPLETE y registra venta en `public.ventas`.
 * Body: { receiver, expectedMinor, assetCode, assetScale, metodo_pago?, id_cliente?, customerWallet? }
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

    // Marca como complete (opcional)
    if (!incoming?.completed) {
      try { await completeIncomingPayment(receiver); } catch (err) { console.warn('⚠️ completeIncomingPayment:', err); }
    }

    // Intentar registrar la venta
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

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`✅ API server listening on http://localhost:${PORT}`);
});
