//server\lib\open-payments-gnap.ts
import {
  createAuthenticatedClient,
  isPendingGrant
} from '@interledger/open-payments';

export type OPCreds = {
  walletAddressUrl: string;  // Wallet del COMERCIO (merchant)
  keyId: string;             // ID de la clave registrada en el Auth Server del comercio
  privateKeyPem: string;     // Clave privada PEM multilínea (Ed25519)
};

// ⚠️ Solo DEV: permite "inyectar" claves desde el front. NO usar en producción.
let RUNTIME_CREDS: OPCreds | null = null;

export function setRuntimeOPCreds(input: Partial<OPCreds>) {
  const prev = RUNTIME_CREDS ?? {
    walletAddressUrl: process.env.WALLET_ADDRESS_URL || '',
    keyId: process.env.OP_KEY_ID || process.env.KEY_ID || '',
    privateKeyPem: process.env.OP_PRIVATE_KEY_PEM || '',
  };
  RUNTIME_CREDS = {
    walletAddressUrl: String(input.walletAddressUrl ?? prev.walletAddressUrl),
    keyId: String(input.keyId ?? prev.keyId),
    privateKeyPem: String(input.privateKeyPem ?? prev.privateKeyPem),
  };
  console.log('✅ Runtime GNAP credentials actualizadas');
}

export function getRuntimeOPCreds(): OPCreds {
  const envCreds: OPCreds = {
    walletAddressUrl: String(process.env.WALLET_ADDRESS_URL || ''),
    keyId: String(process.env.OP_KEY_ID || process.env.KEY_ID || ''),
    privateKeyPem: String(process.env.OP_PRIVATE_KEY_PEM || ''),
  };
  const c = RUNTIME_CREDS ?? envCreds;

  if (!c.walletAddressUrl || !c.keyId || !c.privateKeyPem) {
    throw new Error(
      'Open Payments GNAP: faltan credenciales. Define WALLET_ADDRESS_URL, KEY_ID y OP_PRIVATE_KEY_PEM (o usa OPEN_PAYMENTS_PRIVATE_KEY_B64 en el bootstrap) o usa /api/op/runtime-keys (solo DEV).'
    );
  }
  return c;
}

/** Devuelve un cliente autenticado (firma) y la info de la wallet del comercio */
export async function getMerchantClient() {
  const creds = getRuntimeOPCreds();

  const client = await createAuthenticatedClient({
    walletAddressUrl: creds.walletAddressUrl,
    keyId: creds.keyId,
    privateKey: creds.privateKeyPem,
  });

  const wa = await client.walletAddress.get({ url: creds.walletAddressUrl });

  const merchant = {
    walletAddressUrl: creds.walletAddressUrl,
    resourceServer: wa.resourceServer,
    authServer: wa.authServer,
    assetCode: wa.assetCode ?? 'USD',
    assetScale: wa.assetScale ?? 2,
  };

  console.log('✅ Merchant client creado:', {
    wallet: merchant.walletAddressUrl,
    resourceServer: merchant.resourceServer,
    authServer: merchant.authServer,
    asset: `${merchant.assetCode}/${merchant.assetScale}`
  });

  return { client, merchant };
}

/** Grant NO interactivo del COMERCIO para incoming-payment (con identifier) */
export async function requestMerchantGrant(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  merchant: Awaited<ReturnType<typeof getMerchantClient>>['merchant']
) {
  try {
    console.log('📝 Solicitando grant del comercio para incoming-payment...');
    
    const grant = await client.grant.request(
      { url: merchant.authServer },
      {
        access_token: {
          access: [
            {
              type: 'incoming-payment',
              actions: ['create', 'read', 'list', 'complete'],
              // 🔑 Atamos el token a la wallet del comercio → evita 401/403 en RS
              identifier: merchant.walletAddressUrl
            }
          ],
        },
      }
    );

    if (isPendingGrant(grant)) {
      throw new Error('[merchantGrant] El Auth Server devolvió un grant pendiente (requiere interacción).');
    }
    
    if (!('access_token' in grant) || !grant.access_token?.value) {
      throw new Error('[merchantGrant] Grant sin access_token.');
    }
    
    console.log('✅ Grant del comercio obtenido exitosamente');
    return grant;
  } catch (e: any) {
    const msg = e?.message || 'Error solicitando grant del comercio';
    console.error('❌ Error en merchantGrant:', msg);
    throw new Error(`[merchantGrant] ${msg}`);
  }
}

/** Conveniencia: devuelve solo el access token del grant del comercio */
export async function requestMerchantAccessToken(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  merchant: Awaited<ReturnType<typeof getMerchantClient>>['merchant']
): Promise<string> {
  const g = await requestMerchantGrant(client, merchant);
  return g.access_token.value;
}

/** Resolver servers/asset de cualquier wallet address (cliente) */
export async function resolveWalletServers(walletAddressUrl: string) {
  console.log('🔍 Resolviendo wallet del cliente:', walletAddressUrl);
  
  const { client } = await getMerchantClient();
  const wa = await client.walletAddress.get({ url: walletAddressUrl });
  
  const result = {
    walletAddressUrl,
    resourceServer: wa.resourceServer,
    authServer: wa.authServer,
    assetCode: wa.assetCode ?? 'USD',
    assetScale: wa.assetScale ?? 2,
  };
  
  console.log('✅ Wallet del cliente resuelto:', {
    wallet: result.walletAddressUrl,
    resourceServer: result.resourceServer,
    authServer: result.authServer,
    asset: `${result.assetCode}/${result.assetScale}`
  });
  
  return result;
}

/** Crear Incoming Payment en el comercio usando access token del grant */
export async function createMerchantIncomingPayment(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  merchant: Awaited<ReturnType<typeof getMerchantClient>>['merchant'],
  accessToken: string,
  opts: { amountMinor: number; description?: string }
) {
  if (!Number.isFinite(opts.amountMinor) || opts.amountMinor <= 0) {
    throw new Error('amountMinor inválido');
  }
  
  console.log('💰 Creando incoming payment:', {
    amount: opts.amountMinor,
    asset: `${merchant.assetCode}/${merchant.assetScale}`,
    description: opts.description
  });
  
  const ip = await client.incomingPayment.create(
    { url: merchant.resourceServer, accessToken },
    {
      walletAddress: merchant.walletAddressUrl,
      incomingAmount: {
        value: String(opts.amountMinor),
        assetCode: merchant.assetCode,
        assetScale: merchant.assetScale,
      },
      metadata: opts.description ? { description: opts.description } : undefined,
    }
  );
  
  console.log('✅ Incoming payment creado:', ip.id);
  return ip;
}

/**
 * Grant INTERACTIVO del cliente:
 *  - quote (create/read)
 *  - outgoing-payment (create/read) con "identifier" = wallet del cliente y "limits.receiver" = incoming del comercio
 */
export async function requestCustomerInteractiveGrant(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  customer: Awaited<ReturnType<typeof resolveWalletServers>>,
  params: { receiverUrl: string; finishRedirectUri: string; nonce?: string }
) {
  const nonce = params.nonce ?? Math.random().toString(36).slice(2);

  console.log('🔐 Solicitando grant interactivo del cliente:', {
    wallet: customer.walletAddressUrl,
    receiver: params.receiverUrl,
    redirectUri: params.finishRedirectUri
  });

  const grant = await client.grant.request(
    { url: customer.authServer },
    {
      access_token: {
        access: [
          { type: 'quote', actions: ['create', 'read'] },
          {
            type: 'outgoing-payment',
            actions: ['create', 'read'],
            identifier: customer.walletAddressUrl,
            limits: { receiver: params.receiverUrl }
          }
        ],
      },
      interact: {
        start: ['redirect'],
        finish: { method: 'redirect', uri: params.finishRedirectUri, nonce },
      },
    }
  );

  if (!('interact' in grant)) {
    throw new Error('Se esperaba flujo interactivo (redirect) en grant del cliente');
  }

  console.log('✅ Grant interactivo iniciado:', {
    redirect: grant.interact.redirect,
    continue: grant.continue.uri
  });

  return { grant, nonce };
}

/** Continuar grant del cliente tras el redirect → regresa el Grant final (con access_token) */
export async function continueCustomerGrant(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  continueUri: string,
  continueAccessToken: string,
  interact_ref: string
) {
  console.log('🔄 Continuando grant del cliente con interact_ref...');
  
  const fin = await client.grant.continue(
    { url: continueUri, accessToken: continueAccessToken },
    { interact_ref }
  );
  
  if (!('access_token' in fin) || !fin.access_token?.value) {
    throw new Error('Finalización de grant sin access_token');
  }
  
  console.log('✅ Grant del cliente finalizado exitosamente');
  return fin;
}

/** Crear Quote desde la wallet del cliente hacia el receiver del comercio */
export async function createCustomerQuote(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  customer: Awaited<ReturnType<typeof resolveWalletServers>>,
  accessToken: string,
  receiver: string
) {
  console.log('📋 Creando quote del cliente:', {
    wallet: customer.walletAddressUrl,
    receiver
  });
  
  const q = await client.quote.create(
    { url: customer.resourceServer, accessToken },
    { walletAddress: customer.walletAddressUrl, receiver, method: 'ilp' }
  );
  
  console.log('✅ Quote creado:', {
    id: q.id,
    debitAmount: q.debitAmount,
    receiveAmount: q.receiveAmount
  });
  
  return q;
}

/** Crear Outgoing Payment en la cuenta del cliente usando una Quote aprobada */
export async function createOutgoingPayment(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  customer: Awaited<ReturnType<typeof resolveWalletServers>>,
  accessToken: string,
  quoteId: string
) {
  console.log('💸 Creando outgoing payment del cliente con quote:', quoteId);
  
  const op = await client.outgoingPayment.create(
    { url: customer.resourceServer, accessToken },
    { walletAddress: customer.walletAddressUrl, quoteId }
  );
  
  console.log('✅ Outgoing payment creado:', op.id);
  return op;
}

/* ===== Helper rápido por monto ===== */
export async function createIncomingPaymentByAmount(amount: number, description?: string) {
  const { client, merchant } = await getMerchantClient();
  const amountMinor = Math.round(Number(amount) * Math.pow(10, merchant.assetScale));
  const grant = await requestMerchantGrant(client, merchant);
  const ip = await createMerchantIncomingPayment(client, merchant, grant.access_token.value, {
    amountMinor,
    description,
  });
  return {
    incomingPayment: ip,
    receiver: ip.id,
    assetCode: merchant.assetCode,
    assetScale: merchant.assetScale,
    expectedMinor: amountMinor,
  };
}

/* ===== Helpers con auth del comercio (leer/complete incoming) ===== */
export async function getIncomingWithMerchantAuth(receiverUrl: string) {
  console.log('📖 Leyendo incoming payment con auth del comercio:', receiverUrl);
  
  const { client, merchant } = await getMerchantClient();
  const token = await requestMerchantAccessToken(client, merchant);
  
  try {
    const incoming = await client.incomingPayment.get({ 
      url: receiverUrl, 
      accessToken: token 
    } as any);
    
    console.log('✅ Incoming payment leído:', {
      id: incoming.id,
      receivedAmount: incoming.receivedAmount,
      completed: incoming.completed
    });
    
    return { incoming, client, token };
  } catch (error: any) {
    console.error('❌ Error leyendo incoming payment:', error.message || error);
    throw error;
  }
}

export async function completeIncomingWithMerchantAuth(receiverUrl: string) {
  console.log('✔️ Completando incoming payment con auth del comercio:', receiverUrl);
  
  const { client, token } = await getIncomingWithMerchantAuth(receiverUrl);
  
  try {
    await client.incomingPayment.complete({ 
      url: receiverUrl, 
      accessToken: token 
    } as any);
    
    console.log('✅ Incoming payment completado exitosamente');
  } catch (error: any) {
    console.error('❌ Error completando incoming payment:', error.message || error);
    throw error;
  }
}