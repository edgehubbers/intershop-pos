import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, TrendingUp, Package, Users, DollarSign, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
      content: `¡Hola! Soy tu asistente virtual de negocios impulsado por IA.

Puedo ayudarte con:
• Análisis de ventas en tiempo real
• Gestión de inventario y alertas de stock
• Insights de productos más vendidos
• Información de clientes y lealtad
• Recomendaciones personalizadas

¿En qué puedo ayudarte hoy?`,
      timestamp: new Date()
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const quickActions: QuickAction[] = [
    { label: 'Ventas de hoy', query: '¿Cuáles son las ventas de hoy?', icon: <DollarSign className="w-4 h-4" /> },
    { label: 'Stock bajo', query: '¿Qué productos tienen stock bajo?', icon: <Package className="w-4 h-4" /> },
    { label: 'Top productos', query: 'Muéstrame los productos más vendidos', icon: <TrendingUp className="w-4 h-4" /> },
    { label: 'Categorías', query: '¿Qué categorías tengo?', icon: <Users className="w-4 h-4" /> }
  ];

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => scrollToBottom(), [messages]);

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        if (!response.ok) setError('El servidor no está disponible.');
        else setError(null);
      } catch {
        setError('No se puede conectar al servidor.');
      }
    };
    checkServerHealth();
  }, [API_URL]);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputValue.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: messageText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, userId: null, sucursalId: null, history: messages.slice(-5) })
      });

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

    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${err instanceof Error ? err.message : 'Error desconocido'}\n\nPor favor verifica:\n1. Que el servidor esté corriendo\n2. Que las variables de entorno estén configuradas\n3. Que la API key de Claude sea válida`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setError('Error al comunicarse con el servidor');

    } finally { setIsLoading(false); }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 rounded-lg p-2"><Bot className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Asistente de Negocios con IA</h1>
            <p className="text-sm text-gray-500">Análisis inteligente con Claude</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {error ? 'Desconectado' : 'En línea'}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 overflow-x-auto flex space-x-2">
        {quickActions.map((action, index) => (
          <button key={index} onClick={() => handleSendMessage(action.query)} disabled={isLoading || !!error}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
            {action.icon} <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3 max-w-3xl`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-white border-2 border-indigo-200'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-indigo-600" />}
              </div>
              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-800 shadow-md border border-gray-100'}`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-bold mb-1" {...props} />,
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="ml-2" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                        em: ({node, ...props}) => <em className="italic" {...props} />,
                        code: ({node, inline, ...props}: any) => inline ? 
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props} /> :
                          <code className="block bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
                <span className="text-xs text-gray-500 mt-1 px-2">
                  {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
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
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex flex-col">
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
