// server/lib/open-payments.ts
import { createAuthenticatedClient } from '@interledger/open-payments';
import type { AuthenticatedClient, Grant, PendingGrant } from '@interledger/open-payments';

const WALLET_ADDRESS_URL = process.env.WALLET_ADDRESS_URL!;
const KEY_ID = process.env.KEY_ID!;

function getPrivateKey(): string {
  const rawPem = process.env.OPEN_PAYMENTS_PRIVATE_KEY_PEM;
  if (rawPem && rawPem.trim().length > 0) {
    return rawPem.replace(/\\n/g, '\n');
  }
  const b64 = process.env.OPEN_PAYMENTS_PRIVATE_KEY_B64;
  if (b64 && b64.trim().length > 0) {
    const decoded = Buffer.from(b64, 'base64').toString('utf8').trim();
    if (decoded.includes('BEGIN')) return decoded;
    const body = decoded.match(/.{1,64}/g)?.join('\n') ?? decoded;
    return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
  }
  throw new Error('No private key found: define OPEN_PAYMENTS_PRIVATE_KEY_PEM o OPEN_PAYMENTS_PRIVATE_KEY_B64');
}

let clientInstance: AuthenticatedClient | null = null; // ✅ ya no es Promise<...>

export async function getOpenPaymentsClient(): Promise<AuthenticatedClient> {
  if (clientInstance) return clientInstance;

  if (!WALLET_ADDRESS_URL?.startsWith('https://')) {
    throw new Error('WALLET_ADDRESS_URL debe empezar con https://');
  }
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

export async function createPaymentRequest(amount: number, description: string) {
  const client = await getOpenPaymentsClient(); // ✅ nunca null

  const walletAddress = await client.walletAddress.get({ url: WALLET_ADDRESS_URL });

  // GNAP: puede ser PendingGrant o Grant
  const grantResp = await client.grant.request(
    { url: walletAddress.authServer },
    {
      access_token: {
        access: [{ type: 'incoming-payment', actions: ['create', 'read', 'complete'] }],
      },
    }
  );

  if (!isGrant(grantResp)) {
    // Aquí podrías implementar el flujo "continue" si tu AS lo requiere.
    throw new Error('La autorización requiere interacción (PendingGrant).');
  }

  const accessToken = grantResp.access_token.value;

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
    paymentUrl: incomingPayment.id,
    amount,
    description,
  };
}
