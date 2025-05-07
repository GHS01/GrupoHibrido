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
    return 'http://localhost:8080/api/v1';
  } else {
    // En producción, usar la URL pública (debe ser configurada en el servidor)
    // Si no hay una URL pública configurada, usar una URL de fallback
    return 'https://evolution-api.yourdomain.com/api/v1';
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
    const url = `${getEvolutionApiUrl()}/message/text/${getEvolutionApiInstance()}`;
    
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
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en la respuesta de Evolution API:', errorData);
      throw new Error(`Error en Evolution API: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
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
