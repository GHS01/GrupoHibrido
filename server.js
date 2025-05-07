const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

// Configuración de variables de entorno
// En Vercel, las variables de entorno se configuran en el dashboard
// y están disponibles automáticamente
if (process.env.NODE_ENV !== 'development') {
  require('dotenv').config();
}

// Verificar si las variables de entorno de Supabase están configuradas
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  console.log('Supabase configurado correctamente');
} else {
  console.warn('Supabase no está configurado. Algunas funcionalidades pueden no estar disponibles.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Lista de modelos disponibles en Gemini
const AVAILABLE_MODELS = [
  'gemini-2.0-flash', // Modelo más rápido y eficiente
  'gemini-2.0-pro',   // Modelo más potente
  'gemini-1.5-flash', // Modelo de respaldo
  'gemini-1.5-pro',   // Modelo de respaldo alternativo
  'gemini-pro'        // Modelo legacy como último respaldo
];

// Middleware for parsing JSON and urlencoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API endpoint para verificar si el servidor está funcionando
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API endpoint for admin configuration
app.get('/api/config', (req, res) => {
  try {
    // Only expose necessary configuration values
    res.json({
      adminAccessCode: process.env.ADMIN_ACCESS_CODE || 'default-code',
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
  } catch (error) {
    console.error('Error en /api/config:', error);
    res.status(500).json({
      error: 'Error al obtener la configuración',
      details: error.message
    });
  }
});

// API endpoint for models list
app.get('/api/models', (req, res) => {
  res.json({ models: AVAILABLE_MODELS });
});

// Función para intentar obtener respuesta de un modelo con failover automático
async function tryWithFailover(messages, initialModelIndex = 0) {
  // Verificar la API key de Gemini
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  // Inicializar el cliente de Gemini
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  // Track which models we've tried
  const triedModels = new Set();
  let currentModelIndex = initialModelIndex;
  let lastError = null;

  // Keep trying until we run out of models
  while (triedModels.size < AVAILABLE_MODELS.length) {
    const currentModel = AVAILABLE_MODELS[currentModelIndex];
    triedModels.add(currentModel);

    try {
      console.log(`Intentando con modelo: ${currentModel}`);

      // Convertir el formato de mensajes de chat a formato Gemini
      const formattedContent = formatMessagesForGemini(messages);

      // Generar contenido con Gemini usando la nueva sintaxis
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: formattedContent,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 4096,
        }
      });

      // Extraer el texto de la respuesta
      let content = response.text;

      // Aplicar formato mejorado a la respuesta
      content = enhanceResponseFormatting(content);

      // Si llegamos aquí, la solicitud fue exitosa
      console.log(`Éxito con modelo: ${currentModel}`);

      // Return the successful response along with the model used
      return { content, modelUsed: currentModel, success: true };

    } catch (error) {
      console.error(`Error con modelo ${currentModel}:`, error.message);
      lastError = error;

      // Mover al siguiente modelo en la lista
      currentModelIndex = (currentModelIndex + 1) % AVAILABLE_MODELS.length;

      // Si ya hemos probado este modelo, salimos del bucle
      if (triedModels.has(AVAILABLE_MODELS[currentModelIndex])) {
        break;
      }
    }
  }

  // Si llegamos aquí, todos los modelos han fallado
  throw lastError || new Error('Todos los modelos han fallado');
}

// Función para mejorar el formato de las respuestas
function enhanceResponseFormatting(text) {
  // Limpiar cualquier prefijo de formato que pueda estar causando problemas
  text = text.replace(/^```html\s*/i, '');
  text = text.replace(/^```\s*/i, '');
  text = text.replace(/\s*```$/i, '');
  text = text.replace(/^\d+px;">/i, '');

  // Verificar si el texto ya tiene formato HTML
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(text);

  if (!hasHtmlTags) {
    // Aplicar formato básico si no tiene etiquetas HTML

    // Convertir títulos
    text = text.replace(/^([#]+)\s+(.+)$/gm, (match, hashes, title) => {
      const level = hashes.length;
      if (level <= 6) {
        return `<h${level} style="color: #0066cc; margin-top: 15px; margin-bottom: 10px;">${title}</h${level}>`;
      }
      return match;
    });

    // Convertir subtítulos o secciones importantes
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #0066cc;">$1</strong>');

    // Convertir párrafos
    const paragraphs = text.split('\n\n');
    text = paragraphs.map(p => {
      // Ignorar párrafos que ya tienen etiquetas HTML
      if (p.trim().startsWith('<') && p.trim().endsWith('>')) {
        return p;
      }
      // Ignorar líneas vacías
      if (p.trim() === '') {
        return p;
      }
      return `<p style="margin-bottom: 10px;">${p}</p>`;
    }).join('\n');

    // Convertir listas
    text = text.replace(/^\s*[-*]\s+(.+)$/gm, '<li style="margin-left: 20px; margin-bottom: 5px;">$1</li>');
    text = text.replace(/(<li[^>]*>.*<\/li>\n)+/g, '<ul style="margin-top: 10px; margin-bottom: 10px;">$&</ul>');

    // Convertir listas numeradas
    text = text.replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li style="margin-left: 20px; margin-bottom: 5px;">$2</li>');
    text = text.replace(/(<li[^>]*>.*<\/li>\n)+/g, '<ol style="margin-top: 10px; margin-bottom: 10px;">$&</ol>');

    // Aplicar formato a valores financieros
    text = text.replace(/(\b(?:S\/\.|S\/)?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?)(?:\s*(?:\(Positivo\)|\(Negativo\)))?/g, (match, value) => {
      const isNegative = match.includes('Negativo');
      const color = isNegative ? '#e74c3c' : '#2ecc71';
      return `<span style="color: ${color}; font-weight: bold;">${match}</span>`;
    });

    // Aplicar formato a porcentajes
    text = text.replace(/(\d+(?:\.\d+)?\s*%)/g, '<span style="font-weight: bold;">$1</span>');

    // Envolver todo en un div con estilo
    text = `<div style="font-family: Arial, sans-serif; line-height: 1.5;">${text}</div>`;
  } else {
    // Si ya tiene etiquetas HTML, asegurarse de que no haya marcadores de código
    text = text.replace(/```html|```/g, '');
  }

  return text;
}

// Función para formatear mensajes al formato que espera Gemini
function formatMessagesForGemini(messages) {
  // Convertir mensajes al formato que espera Gemini
  // Para la API más reciente, necesitamos convertir los mensajes a un formato específico

  // Si solo hay un mensaje, devolverlo directamente con instrucciones de formato
  if (messages.length === 1 && messages[0].role === 'user') {
    return `Eres 'Neutro', un asistente financiero profesional. Responde a la siguiente consulta con un formato profesional y bien estructurado. Usa HTML para dar formato a tu respuesta, incluyendo títulos con <h2> y <h3> en color azul (#0066cc), párrafos con <p>, listas con <ul> y <li>, y resalta los valores financieros importantes. Haz que tu respuesta sea visualmente atractiva y fácil de leer.

Consulta: ${messages[0].content}`;
  }

  // Extraer el mensaje del sistema si existe
  let systemMessage = messages.find(msg => msg.role === 'system');

  // Si no hay mensaje del sistema, crear uno con instrucciones de formato
  if (!systemMessage) {
    systemMessage = {
      role: 'system',
      content: `Eres 'Neutro', un asistente financiero profesional especializado en finanzas y contabilidad. Tu nombre es Neutro y debes responder de manera amigable y profesional. Responde solo a preguntas relacionadas con temas financieros, contables, inversiones, ahorro, impuestos y temas relacionados.

IMPORTANTE SOBRE FORMATO: Usa HTML para dar formato a tus respuestas. Usa <h2> y <h3> con estilo "color: #0066cc;" para títulos y subtítulos. Usa <p> para párrafos, <ul> y <li> para listas con viñetas, <ol> y <li> para listas numeradas. Resalta valores financieros importantes con <span style="color: #2ecc71; font-weight: bold;"> para valores positivos y <span style="color: #e74c3c; font-weight: bold;"> para valores negativos. Asegúrate de que tu respuesta sea visualmente atractiva y bien estructurada.`
    };
  } else {
    // Agregar instrucciones de formato al mensaje del sistema existente
    systemMessage.content += `\n\nIMPORTANTE SOBRE FORMATO: Usa HTML para dar formato a tus respuestas. Usa <h2> y <h3> con estilo "color: #0066cc;" para títulos y subtítulos. Usa <p> para párrafos, <ul> y <li> para listas con viñetas, <ol> y <li> para listas numeradas. Resalta valores financieros importantes con <span style="color: #2ecc71; font-weight: bold;"> para valores positivos y <span style="color: #e74c3c; font-weight: bold;"> para valores negativos. Asegúrate de que tu respuesta sea visualmente atractiva y bien estructurada.`;
  }

  // Filtrar mensajes que no son del sistema
  const chatMessages = messages.filter(msg => msg.role !== 'system');

  // Construir la conversación en formato de texto
  let conversation = '';

  // Agregar el mensaje del sistema como contexto
  conversation = systemMessage.content + '\n\n';

  // Agregar los mensajes de la conversación
  for (const message of chatMessages) {
    const role = message.role === 'user' ? 'Human' : 'Assistant';
    conversation += `${role}: ${message.content}\n\n`;
  }

  // Agregar indicación para que el modelo responda como asistente con formato HTML
  conversation += 'Assistant: ';

  return conversation;
}

// API endpoint for chat completions
app.post('/api/chat/completions', async (req, res) => {
  try {
    const { messages, model } = req.body;

    // Verificar la API key de Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    console.log('Using API key:', geminiApiKey.substring(0, 10) + '...');

    // Si se especificó un modelo, intentamos usarlo primero
    let initialModelIndex = 0;
    if (model) {
      // Convertir el nombre del modelo de OpenRouter a Gemini si es necesario
      let geminiModel = model;
      if (model.includes('gemini-2.0-flash')) {
        geminiModel = 'gemini-2.0-flash';
      } else if (model.includes('gemini-pro')) {
        // Si es el modelo legacy, usar gemini-pro, de lo contrario usar gemini-2.0-pro
        geminiModel = model === 'gemini-pro' ? 'gemini-pro' : 'gemini-2.0-pro';
      }

      const modelIndex = AVAILABLE_MODELS.indexOf(geminiModel);
      if (modelIndex !== -1) {
        initialModelIndex = modelIndex;
      } else {
        console.log(`Modelo solicitado ${model} no encontrado en la lista, usando el primero`);
      }
    }

    // Intentar obtener respuesta con failover automático
    const result = await tryWithFailover(messages, initialModelIndex);

    // Responder al cliente con el contenido y el modelo usado
    res.json({
      content: result.content,
      modelUsed: result.modelUsed
    });

  } catch (error) {
    console.error('Error en todos los modelos de Gemini:', error.message);
    console.error('Stack trace:', error.stack);

    res.status(500).json({
      error: 'Error processing request',
      details: error.message,
      message: 'Todos los modelos disponibles fallaron'
    });
  }
});

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
  // Servir archivos estáticos en desarrollo
  app.use(express.static(path.join(__dirname)));

  // Rutas para páginas en desarrollo
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
  });

  // Iniciar servidor en desarrollo
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the application`);

    // Verificar si la API key de Gemini está configurada
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.warn('Gemini API key not configured. AI features will not work.');
    } else {
      console.log(`Using API key: ${geminiApiKey.substring(0, 10)}...`);
      console.log(`Modelos disponibles: ${AVAILABLE_MODELS.join(', ')}`);
    }
  });
}

// Para producción en Vercel
if (process.env.NODE_ENV === 'production') {
  // En Vercel, los archivos estáticos se sirven automáticamente
  // Solo necesitamos definir la ruta principal
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

// Exportar la app para Vercel
module.exports = app;