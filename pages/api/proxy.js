/**
 * Proxy simplificado para Evolution API
 */

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, apikey'
  );

  // Manejar solicitudes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Obtener los datos de la solicitud
    const { phoneNumber, message, apiUrl, instance, apiKey } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Se requiere un número de teléfono' });
    }

    if (!apiUrl || !instance || !apiKey) {
      return res.status(400).json({ error: 'Se requieren los datos de conexión a Evolution API' });
    }

    // Formatear el número de teléfono correctamente
    let formattedNumber = phoneNumber;
    
    // Eliminar cualquier formato especial
    if (formattedNumber.includes('@')) {
      formattedNumber = formattedNumber.split('@')[0];
    }
    
    // Eliminar el signo + si existe
    if (formattedNumber.startsWith('+')) {
      formattedNumber = formattedNumber.substring(1);
    }

    // Construir la URL de Evolution API
    const url = `${apiUrl}/message/sendText/${instance}`;

    console.log(`[Proxy] Enviando mensaje a: ${formattedNumber}`);
    console.log(`[Proxy] URL de la API: ${url}`);

    // Crear el cuerpo de la solicitud
    const requestBody = {
      number: formattedNumber,
      text: message || "Este es un mensaje de prueba de Finance Pro. Si recibe este mensaje, la conexión con WhatsApp está funcionando correctamente.",
      delay: 1200
    };

    console.log('[Proxy] Cuerpo de la solicitud:', JSON.stringify(requestBody, null, 2));

    // Realizar la solicitud a Evolution API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`[Proxy] Respuesta de Evolution API - Status: ${response.status}`);

    // Obtener el cuerpo de la respuesta
    const responseText = await response.text();
    
    let responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      responseBody = { text: responseText };
    }

    // Devolver la respuesta al cliente
    return res.status(response.status).json(responseBody);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
}
