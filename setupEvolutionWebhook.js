// Script para configurar el webhook de Evolution API
// Este script debe ejecutarse después de que Evolution API esté en funcionamiento
// para configurar el webhook que recibirá los mensajes de WhatsApp

// Importar la configuración de Evolution API
import { 
  getEvolutionApiUrl, 
  getEvolutionApiInstance, 
  getEvolutionApiToken 
} from './evolutionApiConfig.js';

// Función para configurar el webhook
async function setupWebhook() {
  try {
    // Obtener la URL de la aplicación
    const appUrl = window.location.origin;
    
    // Construir la URL del webhook
    const webhookUrl = `${appUrl}/api/whatsapp/webhook`;
    
    console.log('Configurando webhook de Evolution API...');
    console.log(`URL del webhook: ${webhookUrl}`);
    
    // Obtener la configuración de Evolution API
    const evolutionApiUrl = getEvolutionApiUrl();
    const instance = getEvolutionApiInstance();
    const token = getEvolutionApiToken();
    
    // Construir la URL para configurar el webhook
    const url = `${evolutionApiUrl}/api/v1/${instance}/webhook`;
    
    console.log(`URL de configuración: ${url}`);
    
    // Enviar la solicitud para configurar el webhook
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': token
      },
      body: JSON.stringify({
        webhook_by_events: false,
        webhook_base_url: webhookUrl,
        webhook_events: {
          // Eventos que activarán el webhook
          application_startup: true,
          qrcode_updated: true,
          messages_upsert: true,
          messages_update: true,
          send_message: true,
          contacts_upsert: true,
          contacts_update: true,
          presence_update: true,
          chats_upsert: true,
          chats_update: true,
          groups_upsert: true,
          groups_update: true,
          status_instance: true
        }
      })
    });
    
    // Verificar la respuesta
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'No se pudo parsear la respuesta de error' };
      }
      console.error('Error al configurar el webhook:', errorData);
      throw new Error(`Error al configurar el webhook: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('Webhook configurado correctamente:', responseData);
    
    // Mostrar notificación de éxito si está disponible la función
    if (typeof showNotification === 'function') {
      showNotification('Éxito', 'Webhook de WhatsApp configurado correctamente', 'success');
    }
    
    return responseData;
  } catch (error) {
    console.error('Error al configurar el webhook:', error);
    
    // Mostrar notificación de error si está disponible la función
    if (typeof showNotification === 'function') {
      showNotification('Error', `No se pudo configurar el webhook: ${error.message}`, 'error');
    }
    
    throw error;
  }
}

// Función para verificar el estado del webhook
async function checkWebhookStatus() {
  try {
    // Obtener la configuración de Evolution API
    const evolutionApiUrl = getEvolutionApiUrl();
    const instance = getEvolutionApiInstance();
    const token = getEvolutionApiToken();
    
    // Construir la URL para verificar el webhook
    const url = `${evolutionApiUrl}/api/v1/${instance}/webhook`;
    
    console.log(`Verificando estado del webhook: ${url}`);
    
    // Enviar la solicitud para verificar el webhook
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': token
      }
    });
    
    // Verificar la respuesta
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: 'No se pudo parsear la respuesta de error' };
      }
      console.error('Error al verificar el webhook:', errorData);
      throw new Error(`Error al verificar el webhook: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('Estado del webhook:', responseData);
    
    return responseData;
  } catch (error) {
    console.error('Error al verificar el webhook:', error);
    throw error;
  }
}

// Exponer funciones globalmente
window.evolutionWebhook = {
  setup: setupWebhook,
  checkStatus: checkWebhookStatus
};

// Exportar funciones
export {
  setupWebhook,
  checkWebhookStatus
};
