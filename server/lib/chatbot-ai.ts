// server/lib/chatbot-ai.ts

import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServer } from './supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatbotWithAI {
  async processMessage(message: string, history: Message[] = []): Promise<string> {
    try {
      console.log('🔄 Procesando mensaje:', message);
      
      const dataNeeds = await this.analyzeQueryNeeds(message);
      const businessData = await this.getBusinessData(dataNeeds);
      const systemPrompt = this.buildSystemPrompt(businessData);
      const response = await this.callClaudeAPI(message, systemPrompt, history);

      return response;
    } catch (error: any) {
      console.error('❌ Error en processMessage:', error);
      return 'Lo siento, hubo un error al procesar tu solicitud.';
    }
  }

  private async analyzeQueryNeeds(message: string) {
    try {
      const analysisPrompt = `Analiza esta pregunta y determina QUÉ DATOS necesitas:

PREGUNTA: "${message}"

TABLAS: ventas, productos, categorias, clientes, proveedores

Responde SOLO con JSON:
{
  "needs_ventas": boolean,
  "needs_productos": boolean,
  "needs_categorias": boolean,
  "needs_clientes": boolean,
  "needs_proveedores": boolean
}`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: analysisPrompt }],
      });

      const firstContent = response.content[0];
      let jsonText = '';
      
      if (firstContent.type === 'text') {
        jsonText = firstContent.text.trim();
      } else {
        throw new Error('Respuesta inesperada de Claude API');
      }
      
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('❌ Error analizando necesidades:', error);
      return {
        needs_ventas: false,
        needs_productos: false,
        needs_categorias: true,
        needs_clientes: false,
        needs_proveedores: false,
      };
    }
  }

  private async getBusinessData(dataNeeds: any) {
    const data: any = {};
    const supabase = getSupabaseServer();

    try {
      if (dataNeeds.needs_categorias) {
        const { data: categorias } = await supabase
          .from('categorias')
          .select('*');

        if (categorias) {
          const categoriasConConteo = await Promise.all(
            categorias.map(async (cat) => {
              const { count } = await supabase
                .from('productos')
                .select('id', { count: 'exact', head: true })
                .eq('id_categoria', cat.id);
              
              return { ...cat, total_productos: count || 0 };
            })
          );
          
          data.categorias = categoriasConConteo;
        }
      }

      if (dataNeeds.needs_ventas) {
        const now = new Date();
        const hoy = now.toISOString().split('T')[0];
        
        const { data: ventas } = await supabase
          .from('ventas')
          .select('id, total, metodo_pago, fecha')
          .gte('fecha', `${hoy}T00:00:00`)
          .lte('fecha', `${hoy}T23:59:59`);

        if (ventas) {
          const total = ventas.reduce((sum, v) => sum + parseFloat(String(v.total)), 0);
          data.ventas = {
            cantidad: ventas.length,
            total,
            ticket_promedio: ventas.length > 0 ? total / ventas.length : 0,
          };
        }
      }

      if (dataNeeds.needs_productos) {
        const { data: productos } = await supabase
          .from('productos')
          .select('id, nombre, stock, precio_venta, unidad_medida, categorias(nombre)')
          .order('stock', { ascending: true })
          .limit(20);

        if (productos) {
          data.productos = productos;
          data.productosBajoStock = productos.filter((p: any) => p.stock < 10);
        }
      }

      return data;
    } catch (error) {
      console.error('❌ Error obteniendo datos:', error);
      return data;
    }
  }

  private buildSystemPrompt(businessData: any): string {
    let prompt = `Eres un asistente virtual para una tienda de abarrotes en México.

IMPORTANTE: 
- Responde en español
- Usa SOLO los datos proporcionados
- Usa emojis y markdown

DATOS DE LA BASE DE DATOS:
`;

    if (businessData.categorias?.length > 0) {
      prompt += `\n📂 CATEGORÍAS (${businessData.categorias.length}):\n`;
      prompt += businessData.categorias
        .map((c: any, i: number) => {
          let info = `${i + 1}. **${c.nombre}**`;
          if (c.descripcion) info += ` - ${c.descripcion}`;
          if (c.total_productos !== undefined) info += ` (${c.total_productos} productos)`;
          return info;
        })
        .join('\n');
    }

    if (businessData.ventas) {
      prompt += `\n\n💰 VENTAS DE HOY:\n`;
      prompt += `- Cantidad: ${businessData.ventas.cantidad}\n`;
      prompt += `- Total: $${businessData.ventas.total.toFixed(2)} MXN\n`;
      prompt += `- Ticket promedio: $${businessData.ventas.ticket_promedio.toFixed(2)}\n`;
    }

    if (businessData.productos?.length > 0) {
      prompt += `\n\n📦 PRODUCTOS (${businessData.productos.length}):\n`;
      prompt += businessData.productos
        .slice(0, 10)
        .map((p: any) => `- ${p.nombre}: ${p.stock} ${p.unidad_medida || 'unidades'} - $${p.precio_venta}`)
        .join('\n');
    }

    return prompt;
  }

  private async callClaudeAPI(userMessage: string, systemPrompt: string, history: Message[]): Promise<string> {
    try {
      // FIX: Filtrar solo role y content del history
      const cleanHistory = history.slice(-5).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const messages = [
        ...cleanHistory,
        { role: 'user' as const, content: userMessage },
      ];

      console.log('📤 Enviando a Claude:', { messageCount: messages.length });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      const firstContent = response.content[0];
      
      if (firstContent.type === 'text') {
        return firstContent.text;
      } else {
        throw new Error('Respuesta inesperada de Claude API');
      }
    } catch (error: any) {
      console.error('❌ Error en Claude API:', error);
      
      // Log más detallado del error
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      
      if (error.status === 401) {
        return '❌ Error de autenticación con Claude API.';
      }
      
      if (error.status === 429) {
        return '⚠️ Límite de solicitudes alcanzado.';
      }

      return `❌ Error: ${error.message}`;
    }
  }
}