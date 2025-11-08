// app/components/chatbot.ts
import { getSupabaseServer } from "../lib/supabase.server";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotContext {
  userId?: number;
  sucursalId?: number;
}

export class BusinessChatbot {
  private context: ChatbotContext;
  private supabase;

  constructor(context: ChatbotContext = {}) {
    this.context = context;
    this.supabase = getSupabaseServer();
  }

  async processMessage(message: string, history: ChatMessage[] = []): Promise<string> {
    const intent = this.detectIntent(message.toLowerCase());
    
    try {
      switch (intent) {
        case 'ventas_hoy':
          return await this.getVentasHoy();
        case 'ventas_periodo':
          return await this.getVentasPeriodo(message);
        case 'productos_bajo_stock':
          return await this.getProductosBajoStock();
        case 'productos_mas_vendidos':
          return await this.getProductosMasVendidos();
        case 'top_clientes':
          return await this.getTopClientes();
        case 'inventario_producto':
          return await this.getInventarioProducto(message);
        case 'reporte_sucursal':
          return await this.getReporteSucursal();
        case 'sugerencias':
          return await this.getSugerencias();
        case 'estado_general':
          return await this.getEstadoGeneral();
        default:
          return await this.getDefaultResponse(message);
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
      return 'Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.';
    }
  }

  private detectIntent(message: string): string {
    if (message.includes('ventas') && (message.includes('hoy') || message.includes('día'))) {
      return 'ventas_hoy';
    }
    if (message.includes('ventas') && (message.includes('semana') || message.includes('mes') || message.includes('periodo'))) {
      return 'ventas_periodo';
    }
    if (message.includes('stock') || message.includes('inventario bajo') || message.includes('productos agotando')) {
      return 'productos_bajo_stock';
    }
    if (message.includes('más vendidos') || message.includes('top productos') || message.includes('mejores productos')) {
      return 'productos_mas_vendidos';
    }
    if (message.includes('top clientes') || message.includes('mejores clientes') || message.includes('clientes frecuentes')) {
      return 'top_clientes';
    }
    if (message.includes('inventario') || message.includes('stock de')) {
      return 'inventario_producto';
    }
    if (message.includes('reporte') || message.includes('resumen') || message.includes('sucursal')) {
      return 'reporte_sucursal';
    }
    if (message.includes('sugerencias') || message.includes('recomienda') || message.includes('qué debo')) {
      return 'sugerencias';
    }
    if (message.includes('estado') || message.includes('cómo va') || message.includes('overview')) {
      return 'estado_general';
    }
    return 'default';
  }

  async getVentasHoy(): Promise<string> {
    try {
      // Obtener fecha actual en zona horaria local
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hoy = `${year}-${month}-${day}`;
      
      console.log('Buscando ventas para fecha:', hoy);
      
      // Consulta más flexible - buscar todas las ventas del día sin importar la hora
      const { data: ventas, error } = await this.supabase
        .from('ventas')
        .select('total, metodo_pago, fecha')
        .gte('fecha', `${hoy}T00:00:00`)
        .lt('fecha', `${hoy}T23:59:59`);

      console.log('Resultado query ventas:', { ventas, error });

      if (error) {
        console.error('Error en query:', error);
        return `❌ Error al consultar ventas: ${error.message}`;
      }

      if (!ventas || ventas.length === 0) {
        // Intentar buscar todas las ventas para debug
        const { data: todasVentas, error: errorTodas } = await this.supabase
          .from('ventas')
          .select('fecha, total, metodo_pago')
          .order('fecha', { ascending: false })
          .limit(5);

        console.log('Últimas ventas en BD:', todasVentas);

        return `📊 **Ventas de Hoy (${hoy})**\n\n` +
               `No se encontraron ventas para hoy.\n\n` +
               `🔍 Debug - Últimas ventas en la BD:\n` +
               (todasVentas && todasVentas.length > 0 
                 ? todasVentas.map(v => `• ${v.fecha}: $${v.total} (${v.metodo_pago})`).join('\n')
                 : 'No hay ventas registradas en la base de datos.');
      }

      const totalVentas = ventas.length;
      const montoTotal = ventas.reduce((sum, v) => sum + parseFloat(String(v.total)), 0);
      const ticketPromedio = totalVentas > 0 ? montoTotal / totalVentas : 0;
      
      // Obtener método de pago más usado
      let metodoPagoMasUsado = 'N/A';
      if (ventas.length > 0) {
        const metodosPago = ventas.map(v => v.metodo_pago).filter(Boolean);
        if (metodosPago.length > 0) {
          metodoPagoMasUsado = this.getMostFrequent(metodosPago);
        }
      }

      return `📊 **Ventas de Hoy (${hoy})**\n\n` +
             `• Total de ventas: ${totalVentas}\n` +
             `• Monto total: $${montoTotal.toFixed(2)}\n` +
             `• Ticket promedio: $${ticketPromedio.toFixed(2)}\n` +
             `• Método de pago más usado: ${metodoPagoMasUsado}`;
    } catch (error) {
      console.error('Error en getVentasHoy:', error);
      return `❌ Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    }
  }

  async getVentasPeriodo(message: string): Promise<string> {
    let dias = 7;
    
    if (message.includes('mes')) dias = 30;
    if (message.includes('semana')) dias = 7;
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);

    const { data: ventas, error } = await this.supabase
      .from('ventas')
      .select('total, fecha')
      .gte('fecha', fechaInicio.toISOString());

    if (error) {
      console.error('Error en getVentasPeriodo:', error);
      return `❌ Error al consultar ventas: ${error.message}`;
    }

    if (!ventas || ventas.length === 0) {
      return `📈 **Ventas de los últimos ${dias} días**\n\nNo se encontraron ventas en este periodo.`;
    }

    const totalVentas = ventas.length;
    const montoTotal = ventas.reduce((sum, v) => sum + parseFloat(String(v.total)), 0);
    const promedioDiario = montoTotal / dias;

    return `📈 **Ventas de los últimos ${dias} días**\n\n` +
           `• Total de ventas: ${totalVentas}\n` +
           `• Monto total: $${montoTotal.toFixed(2)}\n` +
           `• Promedio diario: $${promedioDiario.toFixed(2)}\n` +
           `• Ventas por día: ${(totalVentas / dias).toFixed(1)}`;
  }

  async getProductosBajoStock(): Promise<string> {
    const { data: productos, error } = await this.supabase
      .from('productos')
      .select('nombre, stock, unidad_medida')
      .lt('stock', 10)
      .order('stock', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error en getProductosBajoStock:', error);
      return `❌ Error al consultar productos: ${error.message}`;
    }

    if (!productos || productos.length === 0) {
      return '✅ ¡Excelente! No hay productos con stock bajo en este momento.';
    }

    let response = '⚠️ **Productos con Stock Bajo**\n\n';
    productos.forEach(p => {
      response += `• ${p.nombre}: ${p.stock} ${p.unidad_medida || 'unidades'}\n`;
    });
    
    response += `\n💡 Te recomiendo reabastecer estos productos pronto.`;
    
    return response;
  }

  async getProductosMasVendidos(): Promise<string> {
    try {
      // Primero intentar con la función RPC si existe
      const { data, error } = await this.supabase
        .rpc('get_productos_mas_vendidos', { limite: 10 });

      if (!error && data && data.length > 0) {
        let response = '🏆 **Top 10 Productos Más Vendidos**\n\n';
        data.forEach((p: any, i: number) => {
          response += `${i + 1}. ${p.nombre}\n`;
          response += `   Vendidos: ${p.cantidad_vendida} unidades | Ingresos: $${parseFloat(p.ingresos_totales).toFixed(2)}\n\n`;
        });
        return response;
      }

      // Fallback: consulta manual
      const { data: detalles, error: err } = await this.supabase
        .from('detalle_venta')
        .select('id_producto, cantidad, productos(nombre, precio_venta)');

      if (err) {
        console.error('Error en getProductosMasVendidos:', err);
        return `❌ Error al consultar productos: ${err.message}`;
      }

      if (!detalles || detalles.length === 0) {
        return '📊 No hay suficiente información de ventas para generar este reporte.';
      }

      const productosMap = new Map();
      detalles.forEach(d => {
        const id = d.id_producto;
        if (!productosMap.has(id)) {
          productosMap.set(id, {
            nombre: d.productos?.nombre || 'Producto sin nombre',
            cantidad: 0,
            ingresos: 0
          });
        }
        const p = productosMap.get(id);
        p.cantidad += d.cantidad;
        p.ingresos += d.cantidad * parseFloat(String(d.productos?.precio_venta || '0'));
      });

      const topProductos = Array.from(productosMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);

      if (topProductos.length === 0) {
        return '📊 No hay productos vendidos en el sistema.';
      }

      let response = '🏆 **Top 10 Productos Más Vendidos**\n\n';
      topProductos.forEach((p, i) => {
        response += `${i + 1}. ${p.nombre}\n`;
        response += `   Vendidos: ${p.cantidad} unidades | Ingresos: $${p.ingresos.toFixed(2)}\n\n`;
      });

      return response;
    } catch (error) {
      console.error('Error en getProductosMasVendidos:', error);
      return `❌ Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    }
  }

  async getTopClientes(): Promise<string> {
    const { data: clientes, error } = await this.supabase
      .from('clientes')
      .select('nombre, puntos_acumulados')
      .order('puntos_acumulados', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error en getTopClientes:', error);
      return `❌ Error al consultar clientes: ${error.message}`;
    }

    if (!clientes || clientes.length === 0) {
      return '👥 No hay clientes registrados en el sistema.';
    }

    let response = '👥 **Top 10 Mejores Clientes**\n\n';
    clientes.forEach((c, i) => {
      response += `${i + 1}. ${c.nombre} - ${c.puntos_acumulados} puntos\n`;
    });
    
    response += `\n💡 Considera crear promociones especiales para tus clientes más leales.`;

    return response;
  }

  async getInventarioProducto(message: string): Promise<string> {
    const palabras = message.split(' ');
    const nombreProducto = palabras.slice(palabras.findIndex(p => 
      p.includes('inventario') || p.includes('stock')) + 1).join(' ').trim();

    if (!nombreProducto) {
      return '❓ Por favor especifica el nombre del producto que deseas consultar.';
    }

    const { data: productos, error } = await this.supabase
      .from('productos')
      .select('nombre, stock, precio_venta, unidad_medida, categorias(nombre)')
      .ilike('nombre', `%${nombreProducto}%`)
      .limit(5);

    if (error) {
      console.error('Error en getInventarioProducto:', error);
      return `❌ Error al consultar producto: ${error.message}`;
    }

    if (!productos || productos.length === 0) {
      return `❌ No encontré productos con el nombre "${nombreProducto}".`;
    }

    if (productos.length === 1) {
      const p = productos[0];
      return `📦 **${p.nombre}**\n\n` +
             `• Stock actual: ${p.stock} ${p.unidad_medida || 'unidades'}\n` +
             `• Precio: $${p.precio_venta}\n` +
             `• Categoría: ${p.categorias?.nombre || 'Sin categoría'}\n` +
             `• Estado: ${p.stock < 10 ? '⚠️ Stock bajo' : '✅ Stock suficiente'}`;
    }

    let response = `📦 Encontré ${productos.length} productos:\n\n`;
    productos.forEach(p => {
      response += `• ${p.nombre}: ${p.stock} ${p.unidad_medida || 'unidades'}\n`;
    });

    return response;
  }

  async getReporteSucursal(): Promise<string> {
    if (!this.context.sucursalId) {
      return '❓ Por favor especifica de qué sucursal necesitas el reporte.';
    }

    const { data: sucursal } = await this.supabase
      .from('sucursales')
      .select('nombre')
      .eq('id', this.context.sucursalId)
      .single();

    const now = new Date();
    const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const { data: ventas } = await this.supabase
      .from('ventas')
      .select('total')
      .eq('id_sucursal', this.context.sucursalId)
      .gte('fecha', `${hoy}T00:00:00`);

    const { data: productos } = await this.supabase
      .from('productos')
      .select('stock')
      .eq('id_sucursal', this.context.sucursalId)
      .lt('stock', 10);

    const totalVentas = ventas?.length || 0;
    const montoTotal = ventas?.reduce((sum, v) => sum + parseFloat(String(v.total)), 0) || 0;
    const productosStock = productos?.length || 0;

    return `🏪 **Reporte: ${sucursal?.nombre || 'Sucursal'}**\n\n` +
           `📊 Ventas de Hoy:\n` +
           `• ${totalVentas} ventas realizadas\n` +
           `• Total: $${montoTotal.toFixed(2)}\n\n` +
           `📦 Inventario:\n` +
           `• ${productosStock} productos requieren reabastecimiento\n\n` +
           `${productosStock > 0 ? '⚠️ Acción requerida: Reabastecer inventario' : '✅ Todo en orden'}`;
  }

  async getSugerencias(): Promise<string> {
    const { data: sugerencias } = await this.supabase
      .from('sugerencias_ia')
      .select('tipo, contenido, fecha')
      .order('fecha', { ascending: false })
      .limit(5);

    if (!sugerencias || sugerencias.length === 0) {
      return `💡 **Sugerencias para mejorar tu negocio:**\n\n` +
             `1. Revisa los productos con stock bajo\n` +
             `2. Analiza las ventas de la última semana\n` +
             `3. Contacta a tus mejores clientes con promociones\n` +
             `4. Revisa los productos menos vendidos\n` +
             `5. Optimiza tu inventario basándose en tendencias`;
    }

    let response = `💡 **Sugerencias Recientes:**\n\n`;
    sugerencias.forEach((s, i) => {
      response += `${i + 1}. [${s.tipo}] ${s.contenido}\n`;
    });

    return response;
  }

  async getEstadoGeneral(): Promise<string> {
    const now = new Date();
    const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const [ventasRes, productosRes, clientesRes] = await Promise.all([
      this.supabase.from('ventas').select('total').gte('fecha', `${hoy}T00:00:00`),
      this.supabase.from('productos').select('stock').lt('stock', 10),
      this.supabase.from('clientes').select('id')
    ]);

    const totalVentas = ventasRes.data?.length || 0;
    const montoVentas = ventasRes.data?.reduce((sum, v) => sum + parseFloat(String(v.total)), 0) || 0;
    const productosStock = productosRes.data?.length || 0;
    const totalClientes = clientesRes.data?.length || 0;

    return `📊 **Estado General del Negocio**\n\n` +
           `💰 Ventas Hoy:\n` +
           `• ${totalVentas} ventas | $${montoVentas.toFixed(2)}\n\n` +
           `📦 Inventario:\n` +
           `• ${productosStock} productos con stock bajo\n\n` +
           `👥 Clientes:\n` +
           `• ${totalClientes} clientes registrados\n\n` +
           `${this.getHealthIndicator(totalVentas, productosStock)}`;
  }

  private getHealthIndicator(ventas: number, stockBajo: number): string {
    if (ventas > 10 && stockBajo < 5) return '🟢 Estado: Excelente';
    if (ventas > 5 && stockBajo < 10) return '🟡 Estado: Bueno';
    return '🔴 Estado: Requiere atención';
  }

  async getDefaultResponse(message: string): Promise<string> {
    return `¡Hola! 👋 Soy tu asistente virtual de negocios.\n\n` +
           `Puedo ayudarte con:\n` +
           `• 📊 Ventas (hoy, semana, mes)\n` +
           `• 📦 Inventario y stock\n` +
           `• 🏆 Productos más vendidos\n` +
           `• 👥 Información de clientes\n` +
           `• 💡 Sugerencias para tu negocio\n\n` +
           `¿En qué puedo ayudarte?`;
  }

  private getMostFrequent(arr: string[]): string {
    if (arr.length === 0) return 'N/A';
    
    const frequency = arr.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(frequency).reduce((a, b) => 
      frequency[a] > frequency[b] ? a : b
    );
  }
}

// API Route Handler
export async function POST(req: Request) {
  try {
    const { message, userId, sucursalId, history } = await req.json();
    
    console.log('=== CHATBOT REQUEST ===');
    console.log('Message:', message);
    console.log('UserId:', userId);
    console.log('SucursalId:', sucursalId);
    
    const chatbot = new BusinessChatbot({ userId, sucursalId });
    const response = await chatbot.processMessage(message, history);
    
    console.log('=== CHATBOT RESPONSE ===');
    console.log(response);
    
    return new Response(JSON.stringify({ response }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('=== ERROR EN API ===', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error processing message',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}