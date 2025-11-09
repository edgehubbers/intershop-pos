import { createAuthenticatedClient } from '@interledger/open-payments';
import type { AuthenticatedClient, Grant, PendingGrant } from '@interledger/open-payments';

const WALLET_ADDRESS_URL = process.env.WALLET_ADDRESS_URL!; // p.ej. https://ilp.interledger-test.dev/mishop
const KEY_ID = process.env.KEY_ID!;

function getPrivateKey(): string {
  const rawPem = process.env.OPEN_PAYMENTS_PRIVATE_KEY_PEM;
  if (rawPem && rawPem.trim().length > 0) return rawPem.replace(/\\n/g, '\n');

  const b64 = process.env.OPEN_PAYMENTS_PRIVATE_KEY_B64;
  if (b64 && b64.trim().length > 0) {
    const decoded = Buffer.from(b64, 'base64').toString('utf8').trim();
    if (decoded.includes('BEGIN')) return decoded;
    const body = decoded.match(/.{1,64}/g)?.join('\n') ?? decoded;
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }
  throw new Error('No private key found: define OPEN_PAYMENTS_PRIVATE_KEY_PEM o OPEN_PAYMENTS_PRIVATE_KEY_B64');
}

let clientInstance: AuthenticatedClient | null = null;

export async function getOpenPaymentsClient(): Promise<AuthenticatedClient> {
  if (clientInstance) return clientInstance;
  if (!WALLET_ADDRESS_URL?.startsWith('https://')) throw new Error('WALLET_ADDRESS_URL debe empezar con https://');
  if (!KEY_ID) throw new Error('Falta KEY_ID');

  const privateKey = getPrivateKey();
  clientInstance = await createAuthenticatedClient({
    walletAddressUrl: WALLET_ADDRESS_URL,
    keyId: KEY_ID,
    privateKey,
  });
  return clientInstance;
}

function isGrant(g: Grant | PendingGrant): g is Grant {
  return (g as any)?.access_token?.value !== undefined;
}

// Crea el receiver (incoming payment) y regresa datos útiles para confirmar
export async function createPaymentRequest(amount: number, description: string) {
  const client = await getOpenPaymentsClient();
  const walletAddress = await client.walletAddress.get({ url: WALLET_ADDRESS_URL });

  // Pide permiso para crear/leer/completar incoming-payment
  const grantResp = await client.grant.request(
    { url: walletAddress.authServer },
    {
      access_token: {
        access: [{ type: 'incoming-payment', actions: ['create', 'read', 'complete'] }],
      },
    }
  );
  if (!isGrant(grantResp)) throw new Error('La autorización requiere interacción (PendingGrant).');

  const accessToken = grantResp.access_token.value;

  // Minor units del monto
  const scale = walletAddress.assetScale ?? 2;
  const minorUnits = Math.round(amount * Math.pow(10, scale));

  const incomingPayment = await client.incomingPayment.create(
    { url: walletAddress.resourceServer, accessToken },
    {
      walletAddress: walletAddress.id,
      incomingAmount: {
        value: String(minorUnits),
        assetCode: walletAddress.assetCode ?? 'USD',
        assetScale: scale,
      },
      metadata: { description },
    }
  );

  return {
    receiver: incomingPayment.id,             // URL del incoming payment (Receiver)
    walletAddressUrl: walletAddress.id,       // Tu pointer en formato URL
    assetCode: walletAddress.assetCode ?? 'USD',
    assetScale: scale,
    expectedMinor: minorUnits,                // lo que esperamos recibir en minor units
    amount,                                   // en “decimal” amigable
    description,
  };
}

// Lee el estado del incoming payment
export async function getIncomingPaymentStatus(receiverUrl: string) {
  const client = await getOpenPaymentsClient();
  // Pide permiso para leer
  const walletAddress = await client.walletAddress.get({ url: WALLET_ADDRESS_URL });
  const grantResp = await client.grant.request(
    { url: walletAddress.authServer },
    {
      access_token: {
        access: [{ type: 'incoming-payment', actions: ['read', 'complete'] }],
      },
    }
  );
  if (!isGrant(grantResp)) throw new Error('No se obtuvo grant de lectura.');
  const accessToken = grantResp.access_token.value;

  const incoming = await client.incomingPayment.get({ url: receiverUrl, accessToken });
  return incoming; // incluye receivedAmount { value, assetCode, assetScale }, incomingAmount, completed, expiresAt?
}

// Marca el incoming como completo (opcional)
export async function completeIncomingPayment(receiverUrl: string) {
  const client = await getOpenPaymentsClient();
  const walletAddress = await client.walletAddress.get({ url: WALLET_ADDRESS_URL });
  const grantResp = await client.grant.request(
    { url: walletAddress.authServer },
    {
      access_token: {
        access: [{ type: 'incoming-payment', actions: ['complete', 'read'] }],
      },
    }
  );
  if (!isGrant(grantResp)) throw new Error('No se obtuvo grant para completar.');
  const accessToken = grantResp.access_token.value;

  const res = await client.incomingPayment.complete({ url: receiverUrl, accessToken });
  return res;
}
