import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { FiSend } from "react-icons/fi";
import { BiBot, BiUser } from "react-icons/bi";
import { TbTrendingUp, TbPackage, TbUsers, TbCurrencyDollar } from "react-icons/tb";

interface Message {
  id: string;
  role: "user" | "assistant";
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
      id: "1",
      role: "assistant",
      content: `¡Hola! Soy tu asistente virtual de negocios.

Puedo ayudarte con:
- Análisis de ventas (hoy, últimos 7/30 días, este mes, año, un año específico, etc.)
- Gestión de inventario y alertas de stock
- Productos más vendidos por periodo
- Información de clientes y ticket promedio
- Consejos accionables basados en tus números

Ejemplos que entiendo:
- "Ventas de **este mes** por día"
- "Top 10 productos **últimos 30 días**"
- "¿Qué categorías lideran en **2024**?"
- "Clientes frecuentes **últimos 90 días**"`,
      timestamp: new Date(),
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 👇 Ajusta si usas otro puerto/host para tu backend
  const API_URL =
    typeof window !== "undefined"
      ? import.meta.env.VITE_API_URL || "http://localhost:3001"
      : "http://localhost:3001";

  const quickActions: QuickAction[] = [
    { label: "Ventas de hoy", query: "¿Cuáles son las ventas de hoy?", icon: <TbCurrencyDollar className="w-4 h-4" /> },
    { label: "Stock bajo", query: "¿Qué productos tienen stock bajo?", icon: <TbPackage className="w-4 h-4" /> },
    { label: "Top productos (30d)", query: "Top 10 productos últimos 30 días", icon: <TbTrendingUp className="w-4 h-4" /> },
    { label: "Clientes (90d)", query: "Clientes frecuentes últimos 90 días", icon: <TbUsers className="w-4 h-4" /> },
  ];

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        if (!response.ok) setError("El servidor no está disponible.");
        else setError(null);
      } catch {
        setError("No se puede conectar al servidor.");
      }
    };
    checkServerHealth();
  }, [API_URL]);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputValue.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          // Puedes enviar userId/sucursalId si lo requieres:
          userId: null,
          sucursalId: null,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "Lo siento, no pude procesar tu solicitud.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          `❌ Error: ${err instanceof Error ? err.message : "Error desconocido"}\n\n` +
          `Verifica:\n1) Backend corriendo en ${API_URL}\n2) Variables de entorno\n3) API key de Claude válida`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setError("Error al comunicarse con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ⬇️ full-screen real dentro de la página (sin “gastar” el padding de .page)
  return (
    <div className="-mx-4 sm:-mx-5 lg:-mx-6 -mt-3 h-[100vh] flex flex-col">
      {/* Header compacto */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 rounded-lg p-2">
            <BiBot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-gray-900">Asistente de Negocios</h1>
            <p className="text-xs sm:text-sm text-gray-500">Respuestas basadas en tus datos reales</p>
          </div>
        </div>
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {error ? "Desconectado" : "En línea"}
        </div>
      </div>

      {/* Quick Actions (scroll-x) */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleSendMessage(action.query)}
              disabled={isLoading || !!error}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50 transition"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 bg-gradient-to-br from-gray-50 to-gray-100">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} items-start gap-3 max-w-3xl`}>
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === "user" ? "bg-indigo-600" : "bg-white border-2 border-indigo-200"
                }`}
              >
                {msg.role === "user" ? <BiUser className="w-5 h-5 text-white" /> : <BiBot className="w-5 h-5 text-indigo-600" />}
              </div>
              <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mb-1" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                        li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                        em: ({ node, ...props }) => <em className="italic" {...props} />,
                        code: ({ inline, ...props }: any) =>
                          inline ? (
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-[12px] font-mono" {...props} />
                          ) : (
                            <code className="block bg-gray-100 p-2 rounded text-[12px] font-mono overflow-x-auto" {...props} />
                          ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
                <span className="text-[11px] text-gray-500 mt-1 px-2">
                  {msg.timestamp.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center">
                <BiBot className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex items-end gap-3">
          <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pregunta algo como: 'Ventas por día este mes' o 'Top productos últimos 30 días'…"
              className="w-full bg-transparent resize-none outline-none text-gray-800 placeholder-gray-500"
              rows={1}
              disabled={isLoading || !!error}
            />
          </div>
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading || !!error}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-full transition-colors shadow"
            aria-label="Enviar"
            title="Enviar"
          >
            <FiSend className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-2 text-center">Enter: enviar • Shift+Enter: nueva línea</p>
      </div>
    </div>
  );
}
