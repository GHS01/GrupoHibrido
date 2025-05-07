// Configuración para Evolution API
// Este archivo contiene la configuración para conectar con Evolution API
// tanto en entorno de desarrollo como en producción

// Función para obtener la URL de Evolution API
export function getEvolutionApiUrl() {
  // Verificar si estamos en un entorno de desarrollo local
  const isLocalDevelopment = window.location.hostname === 'localhost' ||
                             window.location.hostname === '127.0.0.1';

  if (isLocalDevelopment) {
    // En desarrollo local, usar la URL local
    return 'http://localhost:8080';
  } else {
    // En producción, usar la URL pública (debe ser configurada en el servidor)
    // Si no hay una URL pública configurada, usar una URL de fallback
    return 'https://evolution-api.yourdomain.com';
  }
}

// Función para obtener la instancia de Evolution API
export function getEvolutionApiInstance() {
  return 'ghs';
}

// Función para obtener el token de Evolution API
export function getEvolutionApiToken() {
  return '0DC6168A59D5-416C-B4CA-9ADE525EEA5E';
}

// Función para obtener el número de teléfono del bot de WhatsApp
export function getBotPhoneNumber() {
  return '+51 997796929';
}

// Función para inicializar la configuración de Evolution API
export function initEvolutionApiConfig() {
  try {
    // Actualizar el número de teléfono del bot en la interfaz
    const botPhoneNumberElement = document.getElementById('botPhoneNumber');
    if (botPhoneNumberElement) {
      botPhoneNumberElement.textContent = getBotPhoneNumber();
    }

    console.log('Configuración de Evolution API inicializada correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar la configuración de Evolution API:', error);
    return false;
  }
}

// Función para enviar un mensaje de prueba a través de Evolution API
export async function sendTestMessage(phoneNumber, message) {
  try {
    // Según la documentación de Evolution API, el endpoint correcto es:
    // /api/v1/instance/sendText
    const url = `${getEvolutionApiUrl()}/api/v1/${getEvolutionApiInstance()}/sendText`;

    // Asegurarse de que el número tenga el formato correcto (con código de país)
    if (!phoneNumber.includes('@')) {
      // Si no tiene @c.us, asumimos que es solo el número y lo formateamos
      if (!phoneNumber.includes('+')) {
        // Si no tiene +, asumimos que necesita el código de país
        phoneNumber = `+${phoneNumber}`;
      }
      // Añadir el sufijo @c.us que requiere WhatsApp
      phoneNumber = `${phoneNumber}@c.us`;
    }

    console.log(`Enviando mensaje a: ${phoneNumber}`);
    console.log(`URL de la API: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': getEvolutionApiToken()
      },
      body: JSON.stringify({
        number: phoneNumber,
        options: {
          delay: 1200
        },
        textMessage: {
          text: message
        }
      })
    });

    // Registrar la respuesta completa para depuración
    console.log(`Respuesta de Evolution API - Status: ${response.status}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'No se pudo parsear la respuesta de error' };
      }
      console.error('Error en la respuesta de Evolution API:', errorData);
      throw new Error(`Error en Evolution API: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('Respuesta exitosa de Evolution API:', responseData);
    return responseData;
  } catch (error) {
    console.error('Error enviando mensaje de prueba:', error);
    throw error;
  }
}

// Exponer funciones globalmente
window.evolutionApiConfig = {
  getUrl: getEvolutionApiUrl,
  getInstance: getEvolutionApiInstance,
  getToken: getEvolutionApiToken,
  getBotPhoneNumber: getBotPhoneNumber,
  init: initEvolutionApiConfig,
  sendTestMessage: sendTestMessage
};

// Inicializar la configuración cuando se carga el documento
document.addEventListener('DOMContentLoaded', function() {
  initEvolutionApiConfig();
});
