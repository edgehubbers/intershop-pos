import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Inicializar Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class ChatbotWithAI {
  constructor(context = {}) {
    this.context = context;
  }

  async processMessage(message, history = []) {
    try {
      console.log("🔄 Procesando mensaje:", message);
      
      // 1. Obtener datos relevantes de la BD
      const businessData = await this.getRelevantBusinessData(message);

      // 2. Construir el prompt con contexto
      const systemPrompt = this.buildSystemPrompt(businessData);

      // 3. Llamar a Claude API
      const response = await this.callClaudeAPI(message, systemPrompt, history);

      return response;
    } catch (error) {
      console.error("❌ Error en processMessage:", error);
      return "Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.";
    }
  }

  async getRelevantBusinessData(message) {
    const lowerMessage = message.toLowerCase();
    const data = {};

    try {
      // Obtener fecha actual
      const now = new Date();
      const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      console.log("📊 Consultando datos del negocio...");

      // Detectar qué datos necesitamos
      const needsVentas = lowerMessage.includes("venta") || 
                         lowerMessage.includes("ingreso") || 
                         lowerMessage.includes("vendido") ||
                         lowerMessage.includes("hoy") ||
                         lowerMessage.includes("cuanto");
      
      const needsProductos = lowerMessage.includes("producto") || 
                            lowerMessage.includes("stock") || 
                            lowerMessage.includes("inventario");
      
      const needsClientes = lowerMessage.includes("cliente");

      // ===== VENTAS DE HOY =====
      if (needsVentas) {
        console.log("🔍 Consultando ventas...");
        
        const { data: ventas, error: errorVentas } = await supabase
          .from("ventas")
          .select("id, total, metodo_pago, fecha")
          .gte("fecha", `${hoy}T00:00:00`)
          .lte("fecha", `${hoy}T23:59:59`);

        if (errorVentas) {
          console.error("❌ Error consultando ventas:", errorVentas);
        } else {
          console.log(`✅ Encontradas ${ventas?.length || 0} ventas de hoy`);
          
          data.ventasHoy = {
            cantidad: ventas?.length || 0,
            total: ventas?.reduce((sum, v) => sum + parseFloat(v.total), 0) || 0,
            ventas: ventas || [],
          };

          // Ventas de la semana
          const semanaAtras = new Date();
          semanaAtras.setDate(semanaAtras.getDate() - 7);

          const { data: ventasSemana } = await supabase
            .from("ventas")
            .select("total, fecha")
            .gte("fecha", semanaAtras.toISOString());

          data.ventasSemana = {
            cantidad: ventasSemana?.length || 0,
            total: ventasSemana?.reduce((sum, v) => sum + parseFloat(v.total), 0) || 0,
          };
        }
      }

      // ===== PRODUCTOS =====
      if (needsProductos) {
        console.log("🔍 Consultando productos...");
        
        const { data: productos, error: errorProductos } = await supabase
          .from("productos")
          .select("id, nombre, stock, precio_venta, unidad_medida, categorias(nombre)")
          .order("stock", { ascending: true })
          .limit(20);

        const { data: productosBajoStock } = await supabase
          .from("productos")
          .select("nombre, stock, unidad_medida")
          .lt("stock", 10);

        if (!errorProductos) {
          data.productos = productos || [];
          data.productosBajoStock = productosBajoStock || [];

          console.log(`✅ ${productos?.length || 0} productos encontrados`);
          console.log(`⚠️  ${productosBajoStock?.length || 0} productos con stock bajo`);
        }

        // Productos más vendidos
        const { data: detalleVentas } = await supabase
          .from("detalle_venta")
          .select("id_producto, cantidad, productos(nombre)");

        if (detalleVentas && detalleVentas.length > 0) {
          const ventasPorProducto = detalleVentas.reduce((acc, d) => {
            const id = d.id_producto;
            if (!acc[id]) {
              acc[id] = {
                nombre: d.productos?.nombre || "Sin nombre",
                cantidad: 0,
              };
            }
            acc[id].cantidad += d.cantidad;
            return acc;
          }, {});

          data.productosMasVendidos = Object.values(ventasPorProducto)
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10);
          
          console.log(`🏆 Top ${data.productosMasVendidos.length} productos más vendidos`);
        }
      }

      // ===== CLIENTES =====
      if (needsClientes) {
        console.log("🔍 Consultando clientes...");
        
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, nombre, puntos_acumulados")
          .order("puntos_acumulados", { ascending: false })
          .limit(10);

        const { data: totalClientesData, count } = await supabase
          .from("clientes")
          .select("id", { count: "exact", head: true });

        data.topClientes = clientes || [];
        data.totalClientes = count || 0;

        console.log(`✅ ${data.totalClientes} clientes totales`);
      }

      console.log("📋 Datos recopilados:", Object.keys(data));
      return data;

    } catch (error) {
      console.error("❌ Error obteniendo datos:", error);
      return {};
    }
  }

  buildSystemPrompt(businessData) {
    let prompt = `Eres un asistente virtual experto en análisis de negocios y punto de venta para una tienda de abarrotes. Tu tarea es ayudar al dueño del negocio a tomar mejores decisiones basadas en los datos reales de su negocio.

IMPORTANTE: 
- Responde SIEMPRE en español de México
- Sé conciso y directo
- Usa emojis para hacer las respuestas más visuales
- Formatea los números con separadores de miles y dos decimales para montos ($1,234.56)
- Si los datos están vacíos o son cero, reconócelo honestamente y sugiere acciones
- NUNCA inventes datos - solo usa la información proporcionada

DATOS ACTUALES DEL NEGOCIO:
`;

    // Agregar ventas de hoy
    if (businessData.ventasHoy) {
      const ticketPromedio = businessData.ventasHoy.cantidad > 0 
        ? businessData.ventasHoy.total / businessData.ventasHoy.cantidad 
        : 0;

      prompt += `
📊 VENTAS DE HOY:
- Número de ventas: ${businessData.ventasHoy.cantidad}
- Total vendido: $${businessData.ventasHoy.total.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})} MXN
- Ticket promedio: $${ticketPromedio.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})} MXN
`;
    }

    // Agregar ventas de la semana
    if (businessData.ventasSemana) {
      prompt += `
📈 VENTAS DE LA ÚLTIMA SEMANA:
- Número de ventas: ${businessData.ventasSemana.cantidad}
- Total: $${businessData.ventasSemana.total.toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})} MXN
- Promedio diario: $${(businessData.ventasSemana.total / 7).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})} MXN
`;
    }

    // Agregar productos con stock bajo
    if (businessData.productosBajoStock && businessData.productosBajoStock.length > 0) {
      prompt += `
⚠️ PRODUCTOS CON STOCK BAJO (menos de 10 unidades):
${businessData.productosBajoStock.map(p => `- ${p.nombre}: ${p.stock} ${p.unidad_medida || "unidades"}`).join("\n")}
`;
    }

    // Agregar productos más vendidos
    if (businessData.productosMasVendidos && businessData.productosMasVendidos.length > 0) {
      prompt += `
🏆 TOP 10 PRODUCTOS MÁS VENDIDOS:
${businessData.productosMasVendidos.map((p, i) => `${i + 1}. ${p.nombre}: ${p.cantidad} unidades vendidas`).join("\n")}
`;
    }

    // Agregar top clientes
    if (businessData.topClientes && businessData.topClientes.length > 0) {
      prompt += `
👥 TOP CLIENTES (por puntos de lealtad):
${businessData.topClientes.map((c, i) => `${i + 1}. ${c.nombre}: ${c.puntos_acumulados} puntos`).join("\n")}
Total de clientes registrados: ${businessData.totalClientes}
`;
    }

    prompt += `

INSTRUCCIONES DE RESPUESTA:
1. Analiza SOLO los datos proporcionados arriba
2. Responde la pregunta de forma clara y concisa
3. Proporciona insights accionables cuando sea relevante
4. Si los datos son insuficientes, menciona qué información adicional necesitarías
5. Usa formato markdown simple para mejor legibilidad (**, •, listas)
6. Si no hay datos disponibles para responder, sé honesto y ofrece alternativas
`;

    return prompt;
  }

  async callClaudeAPI(userMessage, systemPrompt, history) {
    try {
      // Construir mensajes de conversación
      const messages = [
        ...history.slice(-5).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: "user",
          content: userMessage
        }
      ];

      console.log("🤖 Enviando petición a Claude API...");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      });

      const responseText = response.content[0].text;
      console.log("✅ Respuesta recibida de Claude");

      return responseText;
    } catch (error) {
      console.error("❌ Error en Claude API:", error);
      
      if (error.status === 401) {
        return "❌ Error de autenticación con Claude API. Verifica tu API key.";
      }
      
      if (error.status === 429) {
        return "⚠️ Límite de solicitudes alcanzado. Intenta de nuevo en unos momentos.";
      }

      return `❌ Error al procesar con IA: ${error.message}`;
    }
  }
}