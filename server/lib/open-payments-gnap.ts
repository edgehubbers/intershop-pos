// server/lib/open-payments-gnap.ts
import {
  createAuthenticatedClient,
  isPendingGrant
} from '@interledger/open-payments';

export type OPCreds = {
  walletAddressUrl: string;  // Wallet del COMERCIO (merchant)
  keyId: string;             // ID de la clave registrada en el Auth Server del comercio
  privateKeyPem: string;     // Clave privada PEM multilínea (Ed25519)
};

// Solo DEV: permite “inyectar” claves desde el front. NO usar en producción.
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
}

export function getRuntimeOPCreds(): OPCreds {
  const envCreds: OPCreds = {
    walletAddressUrl: String(process.env.WALLET_ADDRESS_URL || ''),
    keyId: String(process.env.OP_KEY_ID || process.env.KEY_ID || ''),
    privateKeyPem: String(process.env.OP_PRIVATE_KEY_PEM || ''),
  };

  // Soportar también .env con OPEN_PAYMENTS_PRIVATE_KEY_B64
  if (!envCreds.privateKeyPem && process.env.OPEN_PAYMENTS_PRIVATE_KEY_B64) {
    try {
      envCreds.privateKeyPem = Buffer.from(
        String(process.env.OPEN_PAYMENTS_PRIVATE_KEY_B64),
        'base64'
      ).toString('utf8').replace(/\r\n/g, '\n').trim();
    } catch { /* noop */ }
  }

  const c = RUNTIME_CREDS ?? envCreds;

  if (!c.walletAddressUrl || !c.keyId || !c.privateKeyPem) {
    throw new Error(
      'Open Payments GNAP: faltan credenciales. Define WALLET_ADDRESS_URL, KEY_ID y OP_PRIVATE_KEY_PEM (o OPEN_PAYMENTS_PRIVATE_KEY_B64) o usa /api/op/runtime-keys (solo DEV).'
    );
  }
  return c;
}

/** Devuelve un cliente autenticado y la info de la wallet del comercio */
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

  return { client, merchant };
}

/** Grant del COMERCIO para incoming-payment (opciones flexibles y fallback) */
async function requestMerchantGrant(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  merchant: Awaited<ReturnType<typeof getMerchantClient>>['merchant'],
  opts?: { actions?: Array<'create'|'read'|'list'|'complete'>; locations?: string[] }
) {
  const actions = opts?.actions ?? ['create', 'read', 'list', 'complete'];
  const accessItem: any = {
    type: 'incoming-payment',
    actions,
    identifier: merchant.walletAddressUrl
  };
  if (opts?.locations?.length) {
    // Algunos AS aceptan locations; el SDK no lo tipa → any
    accessItem.locations = opts.locations;
  }

  try {
    const grant = await client.grant.request(
      { url: merchant.authServer },
      {
        access_token: { access: [ accessItem ] },
      } as any
    );

    if (isPendingGrant(grant)) {
      throw new Error('[merchantGrant] El Auth Server devolvió un grant pendiente.');
    }
    if (!('access_token' in grant) || !grant.access_token?.value) {
      throw new Error('[merchantGrant] Grant sin access_token.');
    }
    return grant;
  } catch (e: any) {
    const msg = e?.message || 'Error solicitando grant del comercio';
    throw new Error(`[merchantGrant] ${msg}`);
  }
}

/** Acceso del COMERCIO con fallback: primero con locations, luego sin */
async function getMerchantAccessTokenSmart(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  merchant: Awaited<ReturnType<typeof getMerchantClient>>['merchant'],
  actions: Array<'create'|'read'|'list'|'complete'>
): Promise<string> {
  try {
    const g1 = await requestMerchantGrant(client, merchant, { actions, locations: [merchant.resourceServer] });
    return g1.access_token.value;
  } catch (e: any) {
    console.warn('[grant-with-locations] fallback sin locations:', e?.message || e);
    const g2 = await requestMerchantGrant(client, merchant, { actions });
    return g2.access_token.value;
  }
}

/** Conveniencia: token del comercio para crear incoming-payment */
export async function requestMerchantAccessToken(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  merchant: Awaited<ReturnType<typeof getMerchantClient>>['merchant']
): Promise<string> {
  return getMerchantAccessTokenSmart(client, merchant, ['create', 'read', 'list', 'complete']);
}

/** Resolver servers/asset de cualquier wallet address (cliente) */
export async function resolveWalletServers(walletAddressUrl: string) {
  const { client } = await getMerchantClient();
  const wa = await client.walletAddress.get({ url: walletAddressUrl });
  return {
    walletAddressUrl,
    resourceServer: wa.resourceServer,
    authServer: wa.authServer,
    assetCode: wa.assetCode ?? 'USD',
    assetScale: wa.assetScale ?? 2,
  };
}

/** Crear Incoming Payment en la cuenta del comercio usando access token del grant */
export async function createMerchantIncomingPayment(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  merchant: Awaited<ReturnType<typeof getMerchantClient>>['merchant'],
  accessToken: string,
  opts: { amountMinor: number; description?: string }
) {
  if (!Number.isFinite(opts.amountMinor) || opts.amountMinor <= 0) {
    throw new Error('amountMinor inválido');
  }
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
  return ip;
}

/** Grant INTERACTIVO del cliente (redirect) */
export async function requestCustomerInteractiveGrant(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  customer: Awaited<ReturnType<typeof resolveWalletServers>>,
  params: { receiverUrl: string; finishRedirectUri: string; nonce?: string }
) {
  const nonce = params.nonce ?? Math.random().toString(36).slice(2);
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
  return { grant, nonce };
}

/** Continuar grant del cliente tras el redirect */
export async function continueCustomerGrant(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  continueUri: string,
  continueAccessToken: string,
  interact_ref: string
) {
  const fin = await client.grant.continue(
    { url: continueUri, accessToken: continueAccessToken },
    { interact_ref }
  );
  if (!('access_token' in fin) || !fin.access_token?.value) {
    throw new Error('Finalización de grant sin access_token');
  }
  return fin;
}

/** Crear Quote desde la wallet del cliente hacia el receiver del comercio */
export async function createCustomerQuote(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  customer: Awaited<ReturnType<typeof resolveWalletServers>>,
  accessToken: string,
  receiver: string
) {
  const q = await client.quote.create(
    { url: customer.resourceServer, accessToken },
    { walletAddress: customer.walletAddressUrl, receiver, method: 'ilp' }
  );
  return q;
}

/** Crear Outgoing Payment con la Quote aprobada */
export async function createOutgoingPayment(
  client: Awaited<ReturnType<typeof getMerchantClient>>['client'],
  customer: Awaited<ReturnType<typeof resolveWalletServers>>,
  accessToken: string,
  quoteId: string
) {
  const op = await client.outgoingPayment.create(
    { url: customer.resourceServer, accessToken },
    { walletAddress: customer.walletAddressUrl, quoteId }
  );
  return op;
}

/* Helper opcional por monto fijo */
export async function createIncomingPaymentByAmount(amount: number, description?: string) {
  const { client, merchant } = await getMerchantClient();
  const amountMinor = Math.round(Number(amount) * Math.pow(10, merchant.assetScale));
  const token = await requestMerchantAccessToken(client, merchant);
  const ip = await createMerchantIncomingPayment(client, merchant, token, { amountMinor, description });
  return {
    incomingPayment: ip,
    receiver: ip.id,
    assetCode: merchant.assetCode,
    assetScale: merchant.assetScale,
    expectedMinor: amountMinor,
  };
}

/* ===== Helpers siempre con auth del comercio (y mensajes claros) ===== */
export async function getIncomingWithMerchantAuth(receiverUrl: string) {
  const { client, merchant } = await getMerchantClient();
  const token = await getMerchantAccessTokenSmart(client, merchant, ['read', 'complete']);
  try {
    const incoming = await client.incomingPayment.get({ url: receiverUrl, accessToken: token } as any);
    return { incoming, client, token };
  } catch (e: any) {
    const msg = e?.message || 'Error leyendo incoming-payment';
    throw new Error(`[incoming.get] ${msg}`);
  }
}

export async function completeIncomingWithMerchantAuth(receiverUrl: string) {
  const { client, token } = await getIncomingWithMerchantAuth(receiverUrl);
  try {
    await client.incomingPayment.complete({ url: receiverUrl, accessToken: token } as any);
  } catch (e: any) {
    const msg = e?.message || 'Error completando incoming-payment';
    throw new Error(`[incoming.complete] ${msg}`);
  }
}
