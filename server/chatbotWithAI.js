import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log("🔧 Supabase inicializado con URL:", process.env.SUPABASE_URL?.substring(0, 30) + "...");

// Inicializar Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

console.log("🔧 Anthropic inicializado con API Key:", process.env.ANTHROPIC_API_KEY?.substring(0, 20) + "...");

class ChatbotWithAI {
  constructor(context = {}) {
    this.context = context;
  }

  async processMessage(message, history = []) {
    try {
      console.log("\n" + "=".repeat(70));
      console.log("🔄 PROCESANDO MENSAJE:", message);
      console.log("=".repeat(70));
      
      // Paso 1: Analizar qué datos necesitamos
      const dataNeeds = await this.analyzeQueryNeeds(message);
      console.log("🧠 Análisis de necesidades:", JSON.stringify(dataNeeds, null, 2));
      
      // Paso 2: Obtener los datos relevantes
      const businessData = await this.getBusinessData(dataNeeds, message);
      console.log("📦 Datos obtenidos:", JSON.stringify(Object.keys(businessData), null, 2));
      
      // Paso 3: Construir el prompt con contexto
      const systemPrompt = this.buildSystemPrompt(businessData);
      console.log("📝 System prompt length:", systemPrompt.length, "caracteres");
      
      // Paso 4: Llamar a Claude API para la respuesta final
      const response = await this.callClaudeAPI(message, systemPrompt, history);

      return response;
    } catch (error) {
      console.error("❌ ERROR EN PROCESSMESSAGE:", error);
      console.error("Stack:", error.stack);
      return "Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo.";
    }
  }

  async analyzeQueryNeeds(message) {
    try {
      console.log("\n🧠 Analizando qué datos se necesitan de la BD...");
      
      const analysisPrompt = `Analiza esta pregunta de un dueño de tienda y determina QUÉ DATOS necesitas de la base de datos.

PREGUNTA: "${message}"

TABLAS DISPONIBLES:
- ventas
- productos  
- categorias (tiene: id, nombre, descripcion)
- clientes
- proveedores

Responde SOLO con JSON:
{
  "needs_ventas": boolean,
  "needs_productos": boolean,
  "needs_categorias": boolean,
  "needs_clientes": boolean,
  "needs_proveedores": boolean
}`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: analysisPrompt
        }]
      });

      let jsonText = response.content[0].text.trim();
      console.log("📄 Respuesta de análisis (raw):", jsonText);
      
      // Limpiar markdown
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const dataNeeds = JSON.parse(jsonText);
      console.log("✅ Análisis parseado:", dataNeeds);
      
      return dataNeeds;
    } catch (error) {
      console.error("❌ Error analizando necesidades:", error);
      // Fallback seguro
      return {
        needs_ventas: false,
        needs_productos: false,
        needs_categorias: true, // Por defecto buscar categorías
        needs_clientes: false,
        needs_proveedores: false
      };
    }
  }

  async getBusinessData(dataNeeds, originalMessage) {
    const data = {};
    
    try {
      console.log("\n📊 Obteniendo datos de la BD según necesidades...");

      // ===== CATEGORÍAS =====
      if (dataNeeds.needs_categorias) {
        console.log("📂 Consultando tabla CATEGORIAS...");
        
        try {
          const { data: categorias, error } = await supabase
            .from("categorias")
            .select("*");

          console.log("🔍 Query resultado:");
          console.log("  - Error:", error);
          console.log("  - Datos:", categorias);
          console.log("  - Cantidad:", categorias?.length || 0);

          if (error) {
            console.error("❌ ERROR EN QUERY DE CATEGORIAS:", error);
            throw error;
          }

          if (categorias && categorias.length > 0) {
            // Contar productos por categoría
            const categoriasConConteo = await Promise.all(
              categorias.map(async (cat) => {
                const { count, error: countError } = await supabase
                  .from("productos")
                  .select("id", { count: "exact", head: true })
                  .eq("id_categoria", cat.id);
                
                if (countError) {
                  console.warn("⚠️  Error contando productos de categoría", cat.nombre, ":", countError);
                }
                
                return {
                  ...cat,
                  total_productos: count || 0
                };
              })
            );
            
            data.categorias = categoriasConConteo;
            console.log("✅ Categorías obtenidas:", categoriasConConteo.length);
            console.log("📋 Detalle:", JSON.stringify(categoriasConConteo, null, 2));
          } else {
            console.log("⚠️  No se encontraron categorías en la BD");
            data.categorias = [];
          }
        } catch (catError) {
          console.error("❌ EXCEPCIÓN al consultar categorías:", catError);
          data.categorias = [];
        }
      }

      // ===== VENTAS =====
      if (dataNeeds.needs_ventas) {
        console.log("💰 Consultando ventas...");
        
        const now = new Date();
        const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        
        const { data: ventas, error } = await supabase
          .from("ventas")
          .select("id, total, metodo_pago, fecha")
          .gte("fecha", `${hoy}T00:00:00`)
          .lte("fecha", `${hoy}T23:59:59`);

        if (error) {
          console.error("❌ Error consultando ventas:", error);
        } else {
          const total = ventas?.reduce((sum, v) => sum + parseFloat(v.total), 0) || 0;
          const cantidad = ventas?.length || 0;
          
          data.ventas = {
            cantidad,
            total,
            ticket_promedio: cantidad > 0 ? total / cantidad : 0,
            detalles: ventas || []
          };
          
          console.log(`✅ ${cantidad} ventas - Total: $${total.toFixed(2)}`);
        }
      }

      // ===== PRODUCTOS =====
      if (dataNeeds.needs_productos) {
        console.log("📦 Consultando productos...");
        
        const { data: productos, error } = await supabase
          .from("productos")
          .select(`
            id, 
            nombre, 
            stock, 
            precio_venta, 
            unidad_medida,
            categorias(nombre)
          `)
          .order("stock", { ascending: true })
          .limit(20);

        if (!error && productos) {
          data.productos = productos;
          data.productosBajoStock = productos.filter(p => p.stock < 10);
          console.log(`✅ ${productos.length} productos encontrados`);
        }
      }

      // ===== CLIENTES =====
      if (dataNeeds.needs_clientes) {
        console.log("👥 Consultando clientes...");
        
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, nombre, puntos_acumulados")
          .order("puntos_acumulados", { ascending: false })
          .limit(10);

        if (clientes) {
          data.topClientes = clientes;
          console.log(`✅ ${clientes.length} clientes obtenidos`);
        }
      }

      // ===== PROVEEDORES =====
      if (dataNeeds.needs_proveedores) {
        console.log("🚚 Consultando proveedores...");
        
        const { data: proveedores } = await supabase
          .from("proveedores")
          .select("id, nombre, contacto, telefono");

        if (proveedores) {
          data.proveedores = proveedores;
          console.log(`✅ ${proveedores.length} proveedores obtenidos`);
        }
      }

      console.log("\n📋 RESUMEN DE DATOS OBTENIDOS:");
      console.log("  - Claves:", Object.keys(data));
      console.log("  - Categorías:", data.categorias?.length || 0);
      console.log("  - Ventas:", data.ventas?.cantidad || 0);
      console.log("  - Productos:", data.productos?.length || 0);
      
      return data;

    } catch (error) {
      console.error("❌ ERROR GENERAL en getBusinessData:", error);
      console.error("Stack:", error.stack);
      return data; // Retornar lo que tengamos hasta ahora
    }
  }

  buildSystemPrompt(businessData) {
    console.log("\n📝 Construyendo system prompt...");
    
    let prompt = `Eres un asistente virtual experto para una tienda de abarrotes en México.

IMPORTANTE: 
- Responde en español de México
- Usa SOLO los datos proporcionados abajo
- Si no tienes datos, dilo honestamente
- Usa emojis y formato markdown

═══════════════════════════════════════════════════
DATOS DE LA BASE DE DATOS:
═══════════════════════════════════════════════════
`;

    // ===== CATEGORÍAS =====
    if (businessData.categorias && businessData.categorias.length > 0) {
      prompt += `
📂 CATEGORÍAS DE PRODUCTOS (${businessData.categorias.length}):
${businessData.categorias.map((c, i) => {
  let info = `${i + 1}. **${c.nombre}**`;
  if (c.descripcion) info += ` - ${c.descripcion}`;
  if (c.total_productos !== undefined) info += ` (${c.total_productos} productos)`;
  return info;
}).join("\n")}
`;
      console.log("✅ Agregadas categorías al prompt");
    } else {
      console.log("⚠️  No hay categorías para agregar al prompt");
    }

    // ===== VENTAS =====
    if (businessData.ventas) {
      prompt += `
💰 VENTAS:
- Total de ventas: ${businessData.ventas.cantidad}
- Monto: $${businessData.ventas.total.toFixed(2)} MXN
- Ticket promedio: $${businessData.ventas.ticket_promedio.toFixed(2)} MXN
`;
    }

    // ===== PRODUCTOS =====
    if (businessData.productos && businessData.productos.length > 0) {
      prompt += `
📦 PRODUCTOS (${businessData.productos.length}):
${businessData.productos.slice(0, 10).map(p => 
  `- ${p.nombre}: ${p.stock} ${p.unidad_medida || "unidades"} - $${p.precio_venta}`
).join("\n")}
`;
    }

    // ===== CLIENTES =====
    if (businessData.topClientes && businessData.topClientes.length > 0) {
      prompt += `
👥 TOP CLIENTES:
${businessData.topClientes.map((c, i) => 
  `${i + 1}. ${c.nombre} - ${c.puntos_acumulados} puntos`
).join("\n")}
`;
    }

    // ===== PROVEEDORES =====
    if (businessData.proveedores && businessData.proveedores.length > 0) {
      prompt += `
🚚 PROVEEDORES (${businessData.proveedores.length}):
${businessData.proveedores.map((p, i) => 
  `${i + 1}. ${p.nombre}${p.contacto ? ` - ${p.contacto}` : ""}`
).join("\n")}
`;
    }

    prompt += `
═══════════════════════════════════════════════════

Responde la pregunta del usuario usando SOLO estos datos.
Si no hay datos suficientes, dilo claramente.
`;

    console.log("📏 System prompt generado:", prompt.length, "caracteres");
    console.log("📄 Prompt completo:\n", prompt);
    
    return prompt;
  }

  async callClaudeAPI(userMessage, systemPrompt, history) {
    try {
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

      console.log("\n🤖 Llamando a Claude API...");
      console.log("📨 Mensajes:", messages.length);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      });

      const responseText = response.content[0].text;
      console.log("✅ Respuesta recibida de Claude");
      console.log("📝 Respuesta:", responseText.substring(0, 200) + "...");

      return responseText;
    } catch (error) {
      console.error("❌ Error en Claude API:", error);
      
      if (error.status === 401) {
        return "❌ Error de autenticación. Verifica tu API key de Claude.";
      }
      
      if (error.status === 429) {
        return "⚠️ Límite de solicitudes alcanzado. Intenta en unos momentos.";
      }

      return `❌ Error: ${error.message}`;
    }
  }
}

export { ChatbotWithAI };