import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

// CAMBIO 1: Importamos la CLASE nombrada, no un 'default'
import { ChatbotWithAI } from "./chatbotHandler.js";

// Cargar variables de entorno
dotenv.config();

const app = express();

// Validar variables de entorno críticas
const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY"];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error("❌ Faltan variables de entorno:", missingEnvVars.join(", "));
  process.exit(1);
}

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!process.env.SUPABASE_URL,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    }
  });
});

// CAMBIO 2: Creamos una función 'async' que USA la clase
app.post("/api/chatbot", async (req, res, next) => {
  const { message, history = [] } = req.body;

  // Validación simple de entrada
  if (!message) {
    return res.status(400).json({ error: "El campo 'message' es requerido." });
  }

  try {
    // 1. Creamos una instancia de tu clase
    const bot = new ChatbotWithAI();
    
    // 2. Llamamos al método para procesar el mensaje
    const response = await bot.processMessage(message, history);
    
    // 3. Enviamos la respuesta de la IA
    res.json({ response: response });

  } catch (error) {
    // 4. Si algo falla, lo pasamos al manejador de errores global
    next(error);
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Manejo de errores globales
app.use((err, req, res, next) => {
  console.error("❌ Error no manejado:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 SERVIDOR BACKEND INICIADO");
  console.log("=".repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chatbot: http://localhost:${PORT}/api/chatbot`);
  console.log("\n📦 Servicios:");
  console.log(`   ✅ Supabase: ${process.env.SUPABASE_URL ? "Configurado" : "❌ Falta"}`);
  console.log(`   ✅ Claude API: ${process.env.ANTHROPIC_API_KEY ? "Configurado" : "❌ Falta"}`);
  console.log(`   ✅ CORS: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log("=".repeat(60) + "\n");
});

// Manejo de cierre graceful
process.on("SIGTERM", () => {
  console.log("\n⏹️  Cerrando servidor...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n⏹️  Cerrando servidor...");
  process.exit(0);
});