const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and urlencoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint for chat completions
app.post('/api/chat/completions', async (req, res) => {
  try {
    const { messages } = req.body;
    
    // OpenRouter API configuration
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    console.log('Using API key:', openRouterApiKey.substring(0, 10) + '...');
    
    // Make request to OpenRouter API using Gemini model
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-pro-exp-02-05:free', // Using Gemini Pro model
        messages: messages,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000', // Local development URL
          'X-Title': 'GHS Finanzas'
        }
      }
    );
    
    // Extract and return the response content
    // Ensure we're handling the response format correctly
    let content = '';
    
    if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      content = response.data.choices[0].message.content;
    } else if (response.data && response.data.content) {
      // Alternative response format
      content = response.data.content;
    } else {
      console.log('Unexpected API response format:', response.data);
      content = 'Lo siento, no pude procesar tu solicitud en este momento.';
    }
    
    res.json({ content });
    
  } catch (error) {
    console.error('Error calling OpenRouter API:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Error processing request', 
      details: error.response?.data || error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the application`);
});