// scripts/test-checkout-flow.ts
// Ejecutar con: npm run ts-node scripts/test-checkout-flow.ts

import fetch from 'node-fetch';

// scripts/test-checkout-flow.js
// Ejecutar con: node scripts/test-checkout-flow.js

const API_BASE = 'http://localhost:3001';
const CUSTOMER_WALLET = 'https://ilp.interledger-test.dev/mishop2';

async function testCheckoutFlow() {
  console.log('\n🧪 PRUEBA COMPLETA DEL FLUJO DE CHECKOUT\n');
  console.log('='.repeat(70));

  try {
    console.log('\n📋 PASO 1: Creando cliente...\n');
    const clienteRes = await fetch(`${API_BASE}/api/tienda/cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Test Cliente',
        correo: 'test@example.com',
        telefono: '1234567890',
        direccion: 'Test Address 123'
      })
    });

    if (!clienteRes.ok) {
      throw new Error(`Error creando cliente: ${clienteRes.status}`);
    }

    const { cliente } = await clienteRes.json();
    console.log('✅ Cliente creado:', cliente.id);

    console.log('\n📋 PASO 2: Creando pedido...\n');
    const pedidoRes = await fetch(`${API_BASE}/api/tienda/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_cliente: cliente.id,
        items: [
          { producto_id: 1, cantidad: 2, precio_unitario: 10.00 }
        ]
      })
    });

    if (!pedidoRes.ok) {
      throw new Error(`Error creando pedido: ${pedidoRes.status}`);
    }

    const { pedido } = await pedidoRes.json();
    console.log('✅ Pedido creado:', pedido.id);
    console.log('   Total:', pedido.total);

    console.log('\n📋 PASO 3: Iniciando checkout GNAP...\n');
    const startRes = await fetch(`${API_BASE}/api/op/checkout/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: pedido.total,
        description: `Pedido Test #${pedido.id}`,
        customerWalletAddress: CUSTOMER_WALLET,
        pedidoId: pedido.id
      })
    });

    if (!startRes.ok) {
      const error = await startRes.json();
      throw new Error(`Error iniciando checkout: ${error.message || startRes.status}`);
    }

    const start = await startRes.json();
    
    if (!start.ok) {
      throw new Error(`Checkout start no ok: ${start.message}`);
    }

    console.log('✅ Checkout iniciado:');
    console.log('   Receiver:', start.payment.receiver);
    console.log('   Expected Minor:', start.payment.expectedMinor);
    console.log('   Asset:', `${start.payment.assetCode}/${start.payment.assetScale}`);

    console.log('\n📋 PASO 4: Probando endpoint de confirmación...\n');
    const confirmRes = await fetch(`${API_BASE}/api/tienda/confirmar-pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver: start.payment.receiver,
        expectedMinor: start.payment.expectedMinor,
        assetCode: start.payment.assetCode,
        assetScale: start.payment.assetScale,
        pedidoId: pedido.id,
        customerWallet: CUSTOMER_WALLET
      })
    });

    if (confirmRes.status === 403) {
      console.log('❌ ERROR 403');
      const error = await confirmRes.json();
      console.log(JSON.stringify(error, null, 2));
      process.exit(1);
    }

    const confirm = await confirmRes.json();
    console.log('✅ Confirmación obtenida:');
    console.log('   Paid:', confirm.paid);
    console.log('   Received:', confirm.receivedMinor || 0);
    console.log('   Expected:', confirm.expectedMinor);

    console.log('\n✅ TODAS LAS PRUEBAS PASARON\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

testCheckoutFlow();