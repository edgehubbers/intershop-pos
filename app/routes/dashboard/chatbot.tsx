// app/routes/dashboard/chatbot.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, TrendingUp, Package, Users, DollarSign, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  query: string;
  icon: React.ReactNode;
}

export default function ChatbotDashboard() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '¡Hola! 👋 Soy tu asistente virtual de negocios impulsado por IA.\n\nPuedo ayudarte con:\n• 📊 Análisis de ventas en tiempo real\n• 📦 Gestión de inventario y alertas de stock\n• 🏆 Insights de productos más vendidos\n• 👥 Información de clientes y lealtad\n• 💡 Recomendaciones personalizadas\n\n¿En qué puedo ayudarte hoy?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const quickActions: QuickAction[] = [
    {
      label: 'Ventas de hoy',
      query: '¿Cuáles son las ventas de hoy?',
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      label: 'Stock bajo',
      query: '¿Qué productos tienen stock bajo?',
      icon: <Package className="w-4 h-4" />
    },
    {
      label: 'Top productos',
      query: 'Muéstrame los productos más vendidos',
      icon: <TrendingUp className="w-4 h-4" />
    },
    {
      label: 'Top clientes',
      query: '¿Quiénes son mis mejores clientes?',
      icon: <Users className="w-4 h-4" />
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Verificar salud del servidor al cargar
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        if (!response.ok) {
          setError('El servidor no está disponible. Por favor inicia el servidor backend.');
        } else {
          setError(null);
        }
      } catch (err) {
        setError('No se puede conectar al servidor. Asegúrate de que esté corriendo en el puerto 3000.');
      }
    };

    checkServerHealth();
  }, [API_URL]);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputValue.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      console.log('📤 Enviando mensaje al servidor...');
      
      const response = await fetch(`${API_URL}/api/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          userId: null,
          sucursalId: null,
          history: messages.slice(-5)
        }),
      });

      console.log('📥 Respuesta del servidor:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Lo siento, no pude procesar tu solicitud.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      console.log('✅ Mensaje procesado correctamente');
      
    } catch (error) {
      console.error('❌ Error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}\n\n` +
                 `Por favor verifica:\n` +
                 `1. Que el servidor esté corriendo (npm run server)\n` +
                 `2. Que las variables de entorno estén configuradas en .env\n` +
                 `3. Que la API key de Claude sea válida`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      setError('Error al comunicarse con el servidor');
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div className="flex flex-col h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 rounded-lg p-2">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Asistente de Negocios con IA</h1>
              <p className="text-sm text-gray-500">Análisis inteligente con Claude</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} rounded-full text-sm font-medium`}>
              {error ? 'Desconectado' : 'En línea'}
            </div>
          </div>
        </div>
        
        {/* Error banner */}
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <strong>Error de conexión:</strong> {error}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex space-x-2 overflow-x-auto">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleSendMessage(action.query)}
              disabled={isLoading || !!error}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3 max-w-3xl`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-indigo-600' 
                  : 'bg-white border-2 border-indigo-200'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-indigo-600" />
                )}
              </div>
              <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-800 shadow-md border border-gray-100'
                }`}>
                  <div className="text-sm whitespace-pre-wrap">
                    {formatMessage(message.content)}
                  </div>
                </div>
                <span className="text-xs text-gray-500 mt-1 px-2">
                  {message.timestamp.toLocaleTimeString('es-MX', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center">
                <Bot className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl shadow-md border border-gray-100">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pregunta algo sobre tu negocio..."
              className="w-full bg-transparent resize-none outline-none text-gray-800 placeholder-gray-500"
              rows={1}
              disabled={isLoading || !!error}
            />
          </div>
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading || !!error}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-full transition-colors shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Presiona Enter para enviar • Shift + Enter para nueva línea
        </p>
      </div>
    </div>
  );
}