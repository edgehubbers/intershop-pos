// scripts/verify-mishop-credentials.ts
// Ejecutar con: npx ts-node scripts/verify-mishop-credentials.ts

import { createAuthenticatedClient } from '@interledger/open-payments';

const WALLET_ADDRESS_URL = 'https://ilp.interledger-test.dev/mishop';
const KEY_ID = '87ae976c-2c3b-4584-8d89-e614252a7c99';
const PRIVATE_KEY_B64 = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUk4R1lkTlBycENDSUVCanR0dVBIUjIwWC80R3RmdkV5QWxKMFk1VlViakoKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQ==';

async function verify() {
  console.log('\n🔍 VERIFICACIÓN DE CREDENCIALES MISHOP\n');
  console.log('='.repeat(70));

  // Decodificar la clave privada
  console.log('\n📋 Paso 1: Decodificando clave privada...\n');
  const privateKeyPem = Buffer.from(PRIVATE_KEY_B64, 'base64').toString('utf8');
  console.log('Clave privada PEM:');
  console.log(privateKeyPem);

  // Crear cliente autenticado
  console.log('\n📋 Paso 2: Creando cliente autenticado...\n');
  let client: any;
  try {
    client = await createAuthenticatedClient({
      walletAddressUrl: WALLET_ADDRESS_URL,
      keyId: KEY_ID,
      privateKey: privateKeyPem,
    });
    console.log('✅ Cliente autenticado creado');
  } catch (e: any) {
    console.log('❌ Error creando cliente:', e.message);
    console.log('\n🔧 SOLUCIÓN:');
    console.log('  1. Verifica que el KEY_ID esté registrado en tu wallet de Rafiki Test');
    console.log('  2. Ve a: https://rafiki.money/ y revisa tus public keys');
    console.log('  3. Asegúrate de que la clave privada corresponda al KEY_ID');
    process.exit(1);
  }

  // Obtener información de la wallet
  console.log('\n📋 Paso 3: Obteniendo información de la wallet...\n');
  let walletInfo: any;
  try {
    walletInfo = await client.walletAddress.get({ url: WALLET_ADDRESS_URL });
    console.log('✅ Información de wallet obtenida:');
    console.log('  Wallet Address:', WALLET_ADDRESS_URL);
    console.log('  Resource Server:', walletInfo.resourceServer);
    console.log('  Auth Server:', walletInfo.authServer);
    console.log('  Asset Code:', walletInfo.assetCode);
    console.log('  Asset Scale:', walletInfo.assetScale);
  } catch (e: any) {
    console.log('❌ Error obteniendo wallet info:', e.message);
    process.exit(1);
  }

  // Solicitar grant
  console.log('\n📋 Paso 4: Solicitando grant para incoming-payment...\n');
  let grant: any;
  try {
    grant = await client.grant.request(
      { url: walletInfo.authServer },
      {
        access_token: {
          access: [
            {
              type: 'incoming-payment',
              actions: ['create', 'read', 'list', 'complete'],
              identifier: WALLET_ADDRESS_URL
            }
          ],
        },
      }
    );

    if ('access_token' in grant && grant.access_token?.value) {
      console.log('✅ Grant obtenido exitosamente');
      console.log('  Access Token (preview):', grant.access_token.value.substring(0, 30) + '...');
    } else {
      console.log('❌ Grant sin access_token');
      console.log('  Grant recibido:', JSON.stringify(grant, null, 2));
      process.exit(1);
    }
  } catch (e: any) {
    console.log('❌ Error solicitando grant:', e.message);
    console.log('\n🔧 SOLUCIÓN:');
    console.log('  El KEY_ID no está autorizado para crear incoming-payments');
    console.log('  Pasos para registrar tu clave:');
    console.log('  1. Ve a https://rafiki.money/');
    console.log('  2. Inicia sesión con tu wallet mishop');
    console.log('  3. Ve a "Developer Keys" o "Public Keys"');
    console.log('  4. Agrega una nueva clave con este KEY_ID:', KEY_ID);
    console.log('  5. Asigna permisos para "incoming-payment"');
    process.exit(1);
  }

  // Crear incoming payment de prueba
  console.log('\n📋 Paso 5: Creando incoming payment de prueba (1.00 USD)...\n');
  let incomingPayment: any;
  try {
    const testAmount = 100; // 1.00 USD
    incomingPayment = await client.incomingPayment.create(
      { url: walletInfo.resourceServer, accessToken: grant.access_token.value },
      {
        walletAddress: WALLET_ADDRESS_URL,
        incomingAmount: {
          value: String(testAmount),
          assetCode: walletInfo.assetCode,
          assetScale: walletInfo.assetScale,
        },
        metadata: { description: 'Test de verificación' },
      }
    );

    console.log('✅ Incoming payment creado:');
    console.log('  ID:', incomingPayment.id);
    console.log('  Monto:', testAmount / Math.pow(10, walletInfo.assetScale), walletInfo.assetCode);
  } catch (e: any) {
    console.log('❌ Error creando incoming payment:', e.message);
    process.exit(1);
  }

  // PASO CRÍTICO: Leer el incoming payment
  console.log('\n📋 Paso 6: Leyendo incoming payment (PASO CRÍTICO)...\n');
  console.log('⚠️  Este es el paso donde suele fallar con 403 Forbidden\n');
  
  try {
    const readPayment = await client.incomingPayment.get({
      url: incomingPayment.id,
      accessToken: grant.access_token.value
    });

    console.log('✅✅✅ ÉXITO! Incoming payment leído correctamente:');
    console.log('  ID:', readPayment.id);
    console.log('  Received Amount:', readPayment.receivedAmount?.value || '0');
    console.log('  Expected Amount:', readPayment.incomingAmount?.value);
    console.log('  Completed:', readPayment.completed);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ TODAS LAS VERIFICACIONES PASARON');
    console.log('='.repeat(70));
    console.log('\nTus credenciales están correctamente configuradas.');
    console.log('El sistema debería funcionar sin problemas.\n');

  } catch (e: any) {
    console.log('❌❌❌ ERROR 403 FORBIDDEN\n');
    console.log('Error completo:', e.message);
    
    console.log('\n🔧 DIAGNÓSTICO:');
    console.log('  El incoming payment se creó, pero no se puede leer.');
    console.log('  Esto significa que el KEY_ID usado NO tiene permisos de lectura.\n');
    
    console.log('📝 SOLUCIONES POSIBLES:\n');
    
    console.log('1️⃣  VERIFICAR PERMISOS DEL KEY_ID:');
    console.log('   a) Ve a https://rafiki.money/');
    console.log('   b) Busca el KEY_ID:', KEY_ID);
    console.log('   c) Asegúrate de que tenga estos permisos:');
    console.log('      - incoming-payment:create ✓');
    console.log('      - incoming-payment:read ✓');
    console.log('      - incoming-payment:complete ✓');
    console.log('      - incoming-payment:list ✓\n');
    
    console.log('2️⃣  REGENERAR EL KEY_ID:');
    console.log('   a) Ve a https://rafiki.money/');
    console.log('   b) Elimina la clave actual');
    console.log('   c) Genera una nueva clave Ed25519');
    console.log('   d) Asigna TODOS los permisos de incoming-payment');
    console.log('   e) Copia el nuevo KEY_ID y la clave privada');
    console.log('   f) Actualiza tu .env\n');
    
    console.log('3️⃣  USAR IDENTIFIER CORRECTO:');
    console.log('   El "identifier" en el grant DEBE ser exactamente:', WALLET_ADDRESS_URL);
    console.log('   (esto ya está correcto en el código)\n');
    
    process.exit(1);
  }
}

verify().catch((e) => {
  console.error('\n💥 Error inesperado:', e);
  process.exit(1);
});

//scripts\verify-mishop-credentials.ts