// server\lib\web-store.ts
import type { Express, Request, Response } from 'express';
import { getSupabaseServer } from './supabase';
import {
  // flujo POS rápido (legacy opcional)
  createPaymentRequest,
  getOpenPaymentsClient,
  // legacy helpers sin auth
  getIncomingPaymentStatus,
  completeIncomingPayment,
} from './open-payments';

import {
  getMerchantClient,
  requestMerchantAccessToken,
  resolveWalletServers,
  createMerchantIncomingPayment,
  requestCustomerInteractiveGrant,
  continueCustomerGrant,
  createCustomerQuote,
  createOutgoingPayment,
  // helpers nuevos con auth explícita
  getIncomingWithMerchantAuth,
  completeIncomingWithMerchantAuth,
} from './open-payments-gnap';

const BUCKET = (process.env.PRODUCTS_BUCKET || 'product-images').trim();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/** Helper: URL pública de Storage */
function publicUrlOf(supabase: ReturnType<typeof getSupabaseServer>, path: string | null) {
  if (!path) return null;
  try {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || null;
  } catch {
    return null;
  }
}

/** Normaliza wallet del cliente: admite $pointer, http/https o dominio sin esquema */
function normalizeWalletAddress(input: string): string {
  const v = String(input || '').trim();
  if (!v) return v;
  if (v.startsWith('$')) return 'https://' + v.slice(1);
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return 'https://' + v;
}

export function attachWebStore(app: Express) {
  // ============================
  // SETTINGS
  // ============================
  app.get('/api/store/settings', async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from('store_settings')
        .select('id, store_name, logo_url, brand_hex')
        .order('id')
        .limit(1);
      if (error) throw error;
      res.json({ ok: true, settings: data?.[0] ?? { store_name: 'MiShop', logo_url: null, brand_hex: '#2563eb' } });
    } catch (e: any) {
      console.error('❌ GET /api/store/settings', e);
      res.status(500).json({ ok: false, message: e?.message ?? 'Error' });
    }
  });

  app.put('/api/store/settings', async (req: Request, res: Response) => {
    try {
      const { store_name, logo_url, brand_hex } = req.body || {};
      const supabase = getSupabaseServer();

      const sel = await supabase.from('store_settings').select('id').order('id').limit(1);
      if (sel.error) throw sel.error;

      if (sel.data?.[0]?.id) {
        const upd = await supabase
          .from('store_settings')
          .update({
            store_name: store_name ?? undefined,
            logo_url: logo_url ?? undefined,
            brand_hex: brand_hex ?? undefined,
          })
          .eq('id', sel.data[0].id)
          .select('id, store_name, logo_url, brand_hex')
          .single();
        if (upd.error) throw upd.error;
        return res.json({ ok: true, settings: upd.data });
      }

      const ins = await supabase
        .from('store_settings')
        .insert({
          store_name: store_name ?? 'MiShop',
          logo_url: logo_url ?? null,
          brand_hex: brand_hex ?? '#2563eb',
        })
        .select('id, store_name, logo_url, brand_hex')
        .single();
      if (ins.error) throw ins.error;
      return res.json({ ok: true, settings: ins.data });
    } catch (e: any) {
      console.error('❌ PUT /api/store/settings', e);
      res.status(500).json({ ok: false, message: e?.message ?? 'Error' });
    }
  });

  // ============================
  // PRODUCTOS PÚBLICOS
  // ============================
  app.get('/api/store/products', async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabaseServer();
      const { data: rows, error } = await supabase
        .from('productos')
        .select(`
          id, nombre, descripcion, precio_venta, stock, imagen_path,
          productos_online!left ( imagen_url, descripcion_web )
        `)
        .gt('stock', 0)
        .order('nombre');
      if (error) throw error;

      const productos = (rows ?? []).map((p: any) => {
        const supaUrl = publicUrlOf(supabase, p.imagen_path);
        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          precio_venta: Number(p.precio_venta),
          stock: Number(p.stock),
          imagen_url: p.productos_online?.[0]?.imagen_url || supaUrl,
          descripcion_web: p.productos_online?.[0]?.descripcion_web ?? null,
        };
      });

      res.json({ productos });
    } catch (e: any) {
      console.error('❌ GET /api/store/products', e);
      res.status(500).json({ message: e?.message ?? 'Error desconocido' });
    }
  });

  // ============================
  // CHECKOUT clásico (cliente/pedido)
  // ============================
  app.post('/api/tienda/cliente', async (req: Request, res: Response) => {
    try {
      const { nombre, correo, telefono, direccion } = req.body || {};
      if (!correo || !nombre) {
        return res.status(400).json({ ok: false, message: 'nombre y correo son requeridos' });
      }

      const supabase = getSupabaseServer();
      const up = await supabase
        .from('clientes')
        .upsert({ 
          nombre, 
          correo, 
          telefono: telefono || null, 
          direccion: direccion || null 
        }, { onConflict: 'correo' })
        .select('id, nombre, correo')
        .single();
        
      if (up.error) throw up.error;

      console.log('✅ Cliente registrado/encontrado:', up.data.id);
      res.json({ ok: true, cliente: up.data });
    } catch (e: any) {
      console.error('❌ POST /api/tienda/cliente', e);
      res.status(500).json({ ok: false, message: e?.message ?? 'Error' });
    }
  });

  app.post('/api/tienda/pedido', async (req: Request, res: Response) => {
    try {
      const { id_cliente, items } = req.body || {};
      
      if (!id_cliente || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ ok: false, message: 'payload inválido' });
      }
      
      const total = items.reduce(
        (acc: number, it: any) => acc + Number(it.precio_unitario || 0) * Number(it.cantidad || 0), 
        0
      );

      const supabase = getSupabaseServer();
      const ins = await supabase
        .from('pedidos_online')
        .insert({ id_cliente, estado: 'pendiente', total })
        .select('id, id_cliente, estado, total')
        .single();
        
      if (ins.error) throw ins.error;

      const detalleRows = items.map((it: any) => ({
        id_pedido: ins.data.id,
        id_producto: Number(it.producto_id),
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        subtotal: Number((Number(it.cantidad) * Number(it.precio_unitario)).toFixed(2)),
      }));
      
      const detIns = await supabase.from('detalle_pedido').insert(detalleRows);
      if (detIns.error) throw detIns.error;

      console.log('✅ Pedido creado:', ins.data.id);
      res.json({ ok: true, pedido: ins.data });
    } catch (e: any) {
      console.error('❌ POST /api/tienda/pedido', e);
      res.status(500).json({ ok: false, message: e?.message ?? 'Error' });
    }
  });

  // ============================
  // GNAP: START (merchant incoming + grant interactivo del cliente)
  // ============================
  app.post('/api/op/checkout/start', async (req: Request, res: Response) => {
    try {
      const { amount, description, customerWalletAddress, pedidoId } = req.body || {};
      
      console.log('🚀 Iniciando checkout GNAP:', { amount, customerWalletAddress, pedidoId });
      
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ ok: false, message: 'amount inválido' });
      }
      
      if (!customerWalletAddress) {
        return res.status(400).json({ ok: false, message: 'customerWalletAddress requerido' });
      }

      // 1) Cliente autenticado del COMERCIO + access token de merchant
      const { client, merchant } = await getMerchantClient();
      const merchantAccessToken = await requestMerchantAccessToken(client, merchant);

      // 2) Minor units según asset del COMERCIO
      const amountMinor = Math.round(Number(amount) * Math.pow(10, merchant.assetScale));

      // 3) Crear Incoming Payment en la cuenta del COMERCIO
      const incoming = await createMerchantIncomingPayment(client, merchant, merchantAccessToken, {
        amountMinor,
        description: description ? String(description) : `Pedido Online #${pedidoId ?? ''}`.trim(),
      });

      // 4) Resolver wallet del CLIENTE (admite $pointer)
      const normalizedWallet = normalizeWalletAddress(String(customerWalletAddress));
      console.log('🔍 Wallet normalizado del cliente:', normalizedWallet);
      
      const customer = await resolveWalletServers(normalizedWallet);

      // 5) Grant interactivo (redirect)
      const inter = await requestCustomerInteractiveGrant(client, customer, {
        receiverUrl: incoming.id,
        finishRedirectUri: `${FRONTEND_URL}/tienda/callback`,
      });

      // (opcional) Persistir receiver en el pedido
      const supabase = getSupabaseServer();
      if (pedidoId) {
        await supabase.from('pedidos_online')
          .update({ receiver: incoming.id })
          .eq('id', Number(pedidoId));
      }

      console.log('✅ Checkout iniciado exitosamente:', {
        receiver: incoming.id,
        redirect: inter.grant.interact.redirect
      });

      return res.json({
        ok: true,
        redirect: inter.grant.interact.redirect,
        continue: {
          uri: inter.grant.continue.uri,
          accessToken: inter.grant.continue.access_token.value,
        },
        payment: {
          receiver: incoming.id,
          assetCode: merchant.assetCode,
          assetScale: merchant.assetScale,
          expectedMinor: amountMinor,
          description: description ?? null,
        },
      });
    } catch (e: any) {
      console.error('❌ POST /api/op/checkout/start', e);
      const msg = e?.message || 'Error iniciando checkout';
      res.status(500).json({ ok: false, message: msg });
    }
  });

  // ============================
  // GNAP: CONTINUE (finaliza grant, crea Quote y Outgoing Payment)
  // ============================
  app.post('/api/op/checkout/continue', async (req: Request, res: Response) => {
    try {
      const {
        continueUri,
        continueAccessToken,
        interact_ref,
        customerWalletAddress,
        receiver,
        pedidoId,
      } = req.body || {};

      console.log('🔄 Continuando grant del cliente:', { interact_ref, receiver, pedidoId });

      if (!continueUri || !continueAccessToken || !interact_ref || !customerWalletAddress || !receiver) {
        return res.status(400).json({ ok: false, message: 'payload incompleto' });
      }

      const { client } = await getMerchantClient();
      const customer = await resolveWalletServers(
        normalizeWalletAddress(String(customerWalletAddress))
      );

      // 1) Finalizar concesión → debe traer access_token
      const fin = await continueCustomerGrant(
        client,
        String(continueUri),
        String(continueAccessToken),
        String(interact_ref)
      );
      
      const custToken = fin.access_token.value;

      // 2) Crear Quote (token del cliente)
      const quote = await createCustomerQuote(client, customer, custToken, String(receiver));

      // 3) Crear Outgoing Payment con la Quote aprobada
      const op = await createOutgoingPayment(client, customer, custToken, quote.id);

      // (opcional) guardar OP id en el pedido
      if (pedidoId) {
        const supabase = getSupabaseServer();
        await supabase.from('pedidos_online')
          .update({ outgoing_payment_id: op.id })
          .eq('id', Number(pedidoId));
      }

      console.log('✅ Grant completado y outgoing payment creado:', {
        outgoingPaymentId: op.id,
        debitAmount: quote.debitAmount,
        receiveAmount: quote.receiveAmount
      });

      res.json({
        ok: true,
        outgoingPaymentId: op.id,
        debitAmount: quote.debitAmount,
        receiveAmount: quote.receiveAmount,
      });
    } catch (e: any) {
      console.error('❌ POST /api/op/checkout/continue', e);
      res.status(500).json({ ok: false, message: e?.message ?? 'Error finalizando checkout' });
    }
  });

  // ============================
  // CONFIRMAR (polling) con incomingPayment URL (siempre con auth del COMERCIO)
  // ============================
  app.post('/api/tienda/confirmar-pago', async (req: Request, res: Response) => {
    try {
      const {
        receiver,
        expectedMinor,
        assetCode,
        assetScale,
        pedidoId,
        customerWallet,
      } = req.body || {};

      if (!receiver || typeof expectedMinor !== 'number' || !assetCode || typeof assetScale !== 'number') {
        return res.status(400).json({ paid: false, message: 'Payload inválido' });
      }

      console.log('🔍 Verificando pago:', { receiver, expectedMinor, assetCode, assetScale });

      // 1) Leer con auth del comercio (fallback a lectura pública si el RS lo permite)
      let incoming: any;
      try {
        const authed = await getIncomingWithMerchantAuth(String(receiver));
        incoming = authed.incoming;
      } catch (err: any) {
        console.warn('⚠️ Fallo auth del comercio, intentando lectura pública:', err.message);
        try {
          incoming = await getIncomingPaymentStatus(String(receiver));
        } catch (publicErr: any) {
          console.error('❌ No se pudo leer incoming (ni con auth ni pública):', publicErr.message);
          return res.status(403).json({ 
            paid: false, 
            message: 'No se puede acceder al incoming payment. Verifica las credenciales del comercio.' 
          });
        }
      }

      const receivedMinor = parseInt(incoming?.receivedAmount?.value ?? '0', 10);
      const paid = receivedMinor >= Number(expectedMinor);

      console.log('📊 Estado del pago:', { 
        receivedMinor, 
        expectedMinor, 
        paid, 
        completed: incoming?.completed 
      });

      if (!paid) {
        return res.json({ 
          paid: false, 
          receivedMinor, 
          expectedMinor, 
          completed: !!incoming?.completed 
        });
      }

      // 2) Completar con auth del comercio; si falla intentar legacy sin auth
      if (!incoming?.completed) {
        console.log('⏳ Completando incoming payment...');
        try {
          await completeIncomingWithMerchantAuth(String(receiver));
        } catch (completeErr: any) {
          console.warn('⚠️ Error completando con auth, intentando sin auth:', completeErr.message);
          try { 
            await completeIncomingPayment(String(receiver)); 
          } catch (legacyErr: any) {
            console.warn('⚠️ No se pudo completar el incoming payment:', legacyErr.message);
          }
        }
      }

      // 3) Persistencia y respuesta
      const supabase = getSupabaseServer();

      if (pedidoId) {
        console.log('💾 Actualizando estado del pedido a "pagado":', pedidoId);
        await supabase
          .from('pedidos_online')
          .update({ 
            estado: 'pagado', 
            receiver: String(receiver), 
            payer_wallet: customerWallet ?? null 
          })
          .eq('id', Number(pedidoId));
      }

      console.log('✅ Pago confirmado exitosamente');

      return res.json({ 
        paid: true, 
        receivedMinor, 
        expectedMinor, 
        assetCode, 
        assetScale 
      });
    } catch (e: any) {
      console.error('❌ POST /api/tienda/confirmar-pago', e);
      res.status(500).json({ paid: false, message: e?.message ?? 'Error confirmando pago' });
    }
  });

  // Alias legacy
  app.get('/api/tienda/productos', (req: any, res: any) =>
    (app as any)._router.handle({ ...req, url: '/api/store/products' }, res, () => {})
  );

  // ============================
  // Flujo simple sin GNAP (opcional)
  // ============================
  app.post('/api/create-payment', async (req: Request, res: Response) => {
    try {
      const { amount, description } = req.body as { amount: number; description: string };
      const numAmount = Number(amount);
      
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: 'amount inválido' });
      }

      const created: any = await createPaymentRequest(numAmount, description ?? '');
      const receiverUrl: string = created?.receiver ?? created?.paymentUrl;
      
      if (!receiverUrl) {
        return res.status(500).json({ success: false, message: 'No se obtuvo receiver' });
      }

      const client = await getOpenPaymentsClient();
      const wallet = await client.walletAddress.get({ url: process.env.WALLET_ADDRESS_URL! });
      const assetScale = wallet.assetScale ?? 2;
      const assetCode  = wallet.assetCode  ?? 'USD';
      const expectedMinor = Math.round(numAmount * Math.pow(10, assetScale));

      res.status(201).json({
        success: true,
        payment: { 
          receiver: receiverUrl, 
          amount: numAmount, 
          description: description ?? '', 
          assetCode, 
          assetScale, 
          expectedMinor 
        },
        walletAddressUrl: process.env.WALLET_ADDRESS_URL,
      });
    } catch (e: any) {
      console.error('❌ Handler /api/create-payment:', e);
      res.status(500).json({ success: false, message: e?.message ?? 'Error desconocido' });
    }
  });

  // Confirmación genérica POS (con auth del comercio)
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
        customerWallet?: string | null;
        items?: Array<{ producto_id: number; cantidad: number; precio_unitario: number }>;
      };

      if (!receiver || typeof expectedMinor !== 'number' || !assetCode || typeof assetScale !== 'number') {
        return res.status(400).json({ paid: false, message: 'Payload inválido' });
      }

      // Leer con auth del comercio
      let incoming: any;
      try {
        const authed = await getIncomingWithMerchantAuth(receiver);
        incoming = authed.incoming;
      } catch (err: any) {
        // Fallback lectura pública
        try {
          incoming = await getIncomingPaymentStatus(receiver);
        } catch {
          console.warn('⚠️ No se pudo leer incoming (ni con auth ni pública):', err?.message || err);
          throw err;
        }
      }

      const receivedMinor = parseInt(incoming?.receivedAmount?.value ?? '0', 10);
      const paid = receivedMinor >= Number(expectedMinor);
      
      if (!paid) {
        return res.json({ paid: false, receivedMinor, expectedMinor, completed: !!incoming?.completed });
      }

      if (!incoming?.completed) {
        try {
          await completeIncomingWithMerchantAuth(receiver);
        } catch {
          try { await completeIncomingPayment(receiver); } catch {}
        }
      }

      const supabase = getSupabaseServer();
      const safeItems = Array.isArray(items) ? items : [];
      const totalFromItems = safeItems.reduce(
        (acc, it) => acc + Number(it.precio_unitario || 0) * Number(it.cantidad || 0), 
        0
      );
      const fallbackTotal = Number((expectedMinor / Math.pow(10, assetScale)).toFixed(2));
      const totalNumber = Number((totalFromItems > 0 ? totalFromItems : fallbackTotal).toFixed(2));

      const { data: ventaRow, error: ventaErr } = await supabase
        .from('ventas')
        .insert({ 
          total: totalNumber, 
          metodo_pago, 
          id_cliente: id_cliente ?? null, 
          receiver, 
          payer_wallet: customerWallet ?? null 
        })
        .select('id')
        .single();

      if (ventaErr) {
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
            expectedMinor 
          });
        }
        console.error('❌ Insert ventas:', ventaErr);
        return res.status(200).json({ 
          paid: true, 
          ventaId: null, 
          receivedMinor, 
          expectedMinor 
        });
      }

      const ventaId = Number(ventaRow.id);

      if (safeItems.length) {
        const detalleRows = safeItems.map((it) => ({
          id_venta: ventaId,
          id_producto: Number(it.producto_id),
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
          subtotal: Number((Number(it.cantidad) * Number(it.precio_unitario)).toFixed(2)),
        }));
        
        const { error: detErr } = await supabase.from('detalle_venta').insert(detalleRows);
        if (detErr) console.error('❌ Insert detalle_venta:', detErr);

        await Promise.all(
          detalleRows.map((it) => 
            supabase.rpc('decrementar_stock', { p_id: it.id_producto, p_qty: it.cantidad })
          )
        ).catch((e) => console.warn('⚠️ decrementar_stock:', e));
      }

      res.json({ 
        paid: true, 
        ventaId, 
        receivedMinor, 
        expectedMinor, 
        assetCode, 
        assetScale 
      });
    } catch (e: any) {
      console.error('❌ /api/payments/confirm:', e);
      res.status(500).json({ paid: false, message: e?.message ?? 'Error confirmando pago' });
    }
  });
}