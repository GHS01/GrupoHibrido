const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

// Configuración de variables de entorno
// En Vercel, las variables de entorno se configuran en el dashboard
// y están disponibles automáticamente
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Lista de modelos disponibles en OpenRouter para probar
const AVAILABLE_MODELS = [
  'google/gemini-flash-1.5-8b-exp', // Modelo más común y estable
  'google/gemini-pro',    // Modelo de Google
  'anthropic/claude-3-haiku-20240307', // Modelo de Anthropic
  'meta-llama/llama-3-8b-instruct', // Modelo de Meta
  'openai/gpt-3.5-turbo' // Modelo de OpenAI como fallback final
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
      adminAccessCode: process.env.ADMIN_ACCESS_CODE || 'default-code'
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
async function tryWithFailover(messages, initialModelIndex = 0, apiKey, refererUrl) {
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
      
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: currentModel,
          messages: messages,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': refererUrl,
            'X-Title': 'GHS Finanzas'
          }
        }
      );
      
      // Si llegamos aquí, la solicitud fue exitosa
      console.log(`Éxito con modelo: ${currentModel}`);
      
      // Extract content from response
      let content = '';
      if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        content = response.data.choices[0].message.content;
      } else if (response.data && response.data.content) {
        content = response.data.content;
      } else {
        console.log('Formato de respuesta inesperado:', response.data);
        content = 'Lo siento, no pude procesar tu solicitud en este momento.';
      }
      
      // Return the successful response along with the model used
      return { content, modelUsed: currentModel, success: true };
      
    } catch (error) {
      console.error(`Error con modelo ${currentModel}:`, error.response?.data || error.message);
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

// API endpoint for chat completions
app.post('/api/chat/completions', async (req, res) => {
  try {
    const { messages, model } = req.body;
    
    // OpenRouter API configuration
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    console.log('Using API key:', openRouterApiKey.substring(0, 10) + '...');
    
    // Determinar la URL de referencia
    const refererUrl = process.env.NODE_ENV === 'production' 
      ? 'https://grupo-hibrida-ucal.vercel.app' 
      : 'http://localhost:3000';
    
    // Si se especificó un modelo, intentamos usarlo primero
    let initialModelIndex = 0;
    if (model) {
      const modelIndex = AVAILABLE_MODELS.indexOf(model);
      if (modelIndex !== -1) {
        initialModelIndex = modelIndex;
      } else {
        console.log(`Modelo solicitado ${model} no encontrado en la lista, usando el primero`);
      }
    }
    
    // Intentar obtener respuesta con failover automático
    const result = await tryWithFailover(messages, initialModelIndex, openRouterApiKey, refererUrl);
    
    // Responder al cliente con el contenido y el modelo usado
    res.json({ 
      content: result.content,
      modelUsed: result.modelUsed 
    });
    
  } catch (error) {
    console.error('Error en todos los modelos de OpenRouter:', error.response?.data || error.message);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({ 
      error: 'Error processing request', 
      details: error.response?.data || error.message,
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
    console.log(`Modelos disponibles: ${AVAILABLE_MODELS.join(', ')}`);
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