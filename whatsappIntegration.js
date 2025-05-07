// WhatsApp Integration Module
// Este módulo permite a los usuarios vincular su número de teléfono a su cuenta
// para recibir consultas financieras a través de WhatsApp

// Función para mostrar el modal de vinculación de WhatsApp
function showWhatsAppLinkModal() {
  // Verificar si el usuario está autenticado usando sessionStorage directamente
  const userId = sessionStorage.getItem('userId');
  if (!userId) {
    showNotification('Error', 'Debe iniciar sesión para vincular su número de WhatsApp', 'error');
    return;
  }

  // Crear el modal si no existe
  if (!document.getElementById('whatsappLinkModal')) {
    const modalHTML = `
      <div id="whatsappLinkModal" class="modal">
        <div class="modal-content">
          <span class="close">&times;</span>
          <h2>Vincular WhatsApp</h2>
          <p>Vincule su número de WhatsApp para consultar su información financiera directamente desde WhatsApp.</p>

          <div class="form-group">
            <label for="whatsappNumber">Número de WhatsApp:</label>
            <input type="tel" id="whatsappNumber" placeholder="Ejemplo: 51912345678" class="form-control">
            <small>Ingrese su número con código de país, sin espacios ni símbolos.</small>
          </div>

          <div class="button-container">
            <button id="linkWhatsAppBtn" class="btn btn-primary">Vincular Número</button>
            <button id="testWhatsAppBtn" class="btn btn-outline-success ms-2">Probar Conexión</button>
            <button id="setupWebhookBtn" class="btn btn-outline-info ms-2">Configurar Webhook</button>
          </div>

          <div id="whatsappInstructions" style="margin-top: 20px; display: none;">
            <h3>Instrucciones:</h3>
            <ol>
              <li>Envíe un mensaje a nuestro número de WhatsApp: <strong id="botPhoneNumber">+51 997796929</strong></li>
              <li>Puede consultar su información financiera con estos comandos:
                <ul>
                  <li><strong>balance</strong> o <strong>saldo</strong>: Ver su estado financiero general</li>
                  <li><strong>gastos</strong>: Ver sus gastos del mes actual</li>
                  <li><strong>ingresos</strong>: Ver sus ingresos del mes actual</li>
                  <li><strong>ahorros</strong>: Ver su saldo de ahorros y movimientos</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>
      </div>
    `;

    // Añadir el modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Configurar eventos
    const modal = document.getElementById('whatsappLinkModal');
    const closeBtn = modal.querySelector('.close');
    const linkBtn = document.getElementById('linkWhatsAppBtn');

    closeBtn.onclick = function() {
      modal.style.display = 'none';
    };

    window.onclick = function(event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };

    linkBtn.onclick = linkWhatsAppNumber;

    // Configurar el botón de prueba
    const testBtn = document.getElementById('testWhatsAppBtn');
    if (testBtn) {
      testBtn.onclick = testWhatsAppConnection;
    }

    // Configurar el botón de configuración del webhook
    const setupWebhookBtn = document.getElementById('setupWebhookBtn');
    if (setupWebhookBtn) {
      setupWebhookBtn.onclick = setupEvolutionWebhook;
    }
  }

  // Mostrar el modal
  const modal = document.getElementById('whatsappLinkModal');
  modal.style.display = 'block';

  // Cargar el número de teléfono actual del usuario si existe
  loadUserPhoneNumber();
}

// Función para configurar el webhook de Evolution API
async function setupEvolutionWebhook() {
  try {
    // Verificar si se está usando Supabase
    if (!isUsingSupabase()) {
      showNotification('Error', 'Esta función solo está disponible con Supabase', 'error');
      return;
    }

    // Mostrar notificación de espera
    showNotification('Configurando...', 'Configurando webhook de WhatsApp...', 'info');

    // Verificar si existe la función de configuración en evolutionWebhook
    if (window.evolutionWebhook && typeof window.evolutionWebhook.setup === 'function') {
      // Usar la función de evolutionWebhook
      const result = await window.evolutionWebhook.setup();
      console.log('Resultado de la configuración del webhook:', result);
    } else {
      // Implementación alternativa si no está disponible evolutionWebhook
      throw new Error('No se encontró la función para configurar el webhook. Asegúrese de que el archivo setupEvolutionWebhook.js esté cargado correctamente.');
    }

    // Mostrar notificación de éxito
    showNotification('Éxito', 'Webhook de WhatsApp configurado correctamente', 'success');
  } catch (error) {
    console.error('Error al configurar el webhook:', error);
    showNotification('Error', `No se pudo configurar el webhook: ${error.message}`, 'error');
  }
}

// Función para probar la conexión con Evolution API
async function testWhatsAppConnection() {
  try {
    // Verificar si se está usando Supabase
    if (!isUsingSupabase()) {
      showNotification('Error', 'Esta función solo está disponible con Supabase', 'error');
      return;
    }

    // Obtener el número de teléfono
    const phoneNumberInput = document.getElementById('whatsappNumber');
    let phoneNumber = phoneNumberInput.value.trim();

    // Validar el número de teléfono
    if (!phoneNumber) {
      showNotification('Error', 'Debe ingresar un número de teléfono para la prueba', 'error');
      return;
    }

    // Eliminar cualquier carácter que no sea número
    phoneNumber = phoneNumber.replace(/\D/g, '');

    // Validar que tenga al menos 10 dígitos
    if (phoneNumber.length < 10) {
      showNotification('Error', 'El número de teléfono debe tener al menos 10 dígitos', 'error');
      return;
    }

    // Mostrar notificación de espera
    showNotification('Enviando...', 'Enviando mensaje de prueba a WhatsApp...', 'info');

    // Verificar si existe la función de prueba en evolutionApiConfig
    if (window.evolutionApiConfig && typeof window.evolutionApiConfig.sendTestMessage === 'function') {
      // Usar la función de evolutionApiConfig
      await window.evolutionApiConfig.sendTestMessage(
        phoneNumber,
        "Este es un mensaje de prueba de Finance Pro. Si recibe este mensaje, la conexión con WhatsApp está funcionando correctamente."
      );
    } else {
      // Implementación alternativa si no está disponible evolutionApiConfig
      // Según la documentación de Evolution API v2, el endpoint correcto es:
      // /message/sendText/{instance}
      const evolutionApiUrl = 'https://five-plums-bake.loca.lt';
      const evolutionApiInstance = 'ghs';
      const evolutionApiToken = '0DC6168A59D5-416C-B4CA-9ADE525EEA5E';

      // Formatear el número de teléfono correctamente para la API
      if (phoneNumber.includes('@')) {
        // Si tiene @, eliminamos esa parte y dejamos solo el número
        phoneNumber = phoneNumber.split('@')[0];
      }

      // Asegurarse de que tenga el formato correcto para la API
      if (phoneNumber.startsWith('+')) {
        // Si tiene +, lo eliminamos porque la API no lo necesita
        phoneNumber = phoneNumber.substring(1);
      }

      console.log(`Enviando mensaje a: ${phoneNumber}`);
      const url = `${evolutionApiUrl}/message/sendText/${evolutionApiInstance}`;
      console.log(`URL de la API: ${url}`);

      // Crear el cuerpo de la solicitud
      const requestBody = {
        number: phoneNumber,
        text: "Este es un mensaje de prueba de Finance Pro. Si recibe este mensaje, la conexión con WhatsApp está funcionando correctamente.",
        delay: 1200
      };

      console.log('Cuerpo de la solicitud:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiToken
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`Respuesta de Evolution API - Status: ${response.status}`);

      // Intentar obtener el cuerpo de la respuesta independientemente del estado
      let responseBody;
      try {
        const responseText = await response.text();
        console.log('Respuesta en texto plano:', responseText);

        try {
          responseBody = JSON.parse(responseText);
          console.log('Respuesta parseada:', responseBody);
        } catch (e) {
          console.log('No se pudo parsear la respuesta como JSON');
          responseBody = { text: responseText };
        }
      } catch (e) {
        console.log('No se pudo obtener el texto de la respuesta:', e);
        responseBody = { error: 'No se pudo obtener la respuesta' };
      }

      if (!response.ok) {
        console.error('Error en la respuesta de Evolution API:', responseBody);
        throw new Error(`Error en Evolution API: ${response.status} ${response.statusText}`);
      }

      console.log('Respuesta exitosa de Evolution API:', responseBody);
    }

    // Mostrar notificación de éxito
    showNotification('Éxito', 'Mensaje de prueba enviado correctamente. Verifique su WhatsApp.', 'success');
  } catch (error) {
    console.error('Error al enviar mensaje de prueba:', error);
    showNotification('Error', `No se pudo enviar el mensaje de prueba: ${error.message}`, 'error');
  }
}

// Función para cargar el número de teléfono actual del usuario
async function loadUserPhoneNumber() {
  try {
    // Verificar si se está usando Supabase
    if (!isUsingSupabase()) {
      showNotification('Error', 'Esta función solo está disponible con Supabase', 'error');
      return;
    }

    // Obtener el ID del usuario desde sessionStorage
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
      showNotification('Error', 'Usuario no autenticado', 'error');
      return;
    }

    // Obtener el perfil del usuario
    const { data: profile, error } = await getSupabaseClient()
      .from('users')
      .select('phone_number')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error al obtener el perfil del usuario:', error);
      return;
    }

    // Mostrar el número de teléfono en el input
    if (profile && profile.phone_number) {
      document.getElementById('whatsappNumber').value = profile.phone_number;
      // Mostrar las instrucciones
      document.getElementById('whatsappInstructions').style.display = 'block';
    }
  } catch (error) {
    console.error('Error al cargar el número de teléfono:', error);
  }
}

// Función para vincular el número de WhatsApp
async function linkWhatsAppNumber() {
  try {
    // Verificar si se está usando Supabase
    if (!isUsingSupabase()) {
      showNotification('Error', 'Esta función solo está disponible con Supabase', 'error');
      return;
    }

    // Obtener el número de teléfono
    const phoneNumberInput = document.getElementById('whatsappNumber');
    let phoneNumber = phoneNumberInput.value.trim();

    // Validar el número de teléfono
    if (!phoneNumber) {
      showNotification('Error', 'Debe ingresar un número de teléfono', 'error');
      return;
    }

    // Eliminar cualquier carácter que no sea número
    phoneNumber = phoneNumber.replace(/\D/g, '');

    // Validar que tenga al menos 10 dígitos
    if (phoneNumber.length < 10) {
      showNotification('Error', 'El número de teléfono debe tener al menos 10 dígitos', 'error');
      return;
    }

    // Obtener el ID del usuario desde sessionStorage
    const userId = sessionStorage.getItem('userId');
    if (!userId) {
      showNotification('Error', 'Usuario no autenticado', 'error');
      return;
    }

    // Actualizar el perfil del usuario
    const { error } = await getSupabaseClient()
      .from('users')
      .update({ phone_number: phoneNumber })
      .eq('id', userId);

    if (error) {
      console.error('Error al actualizar el perfil del usuario:', error);
      showNotification('Error', 'No se pudo vincular el número de WhatsApp', 'error');
      return;
    }

    // Mostrar notificación de éxito
    showNotification('Éxito', 'Número de WhatsApp vinculado correctamente', 'success');

    // Mostrar las instrucciones
    document.getElementById('whatsappInstructions').style.display = 'block';

    // Actualizar el valor del input con el número formateado
    phoneNumberInput.value = phoneNumber;
  } catch (error) {
    console.error('Error al vincular el número de WhatsApp:', error);
    showNotification('Error', 'No se pudo vincular el número de WhatsApp', 'error');
  }
}

// Función para verificar si se está usando Supabase
function isUsingSupabase() {
  return localStorage.getItem('useSupabase') === 'true';
}

// Función para obtener el cliente de Supabase
function getSupabaseClient() {
  if (typeof window.supabase !== 'undefined') {
    return window.supabase;
  } else if (typeof window.supabaseService !== 'undefined' && window.supabaseService.getClient) {
    return window.supabaseService.getClient();
  } else {
    throw new Error('Cliente de Supabase no disponible');
  }
}

// Función para obtener el usuario actual
function getCurrentUser() {
  const userId = sessionStorage.getItem('userId');
  const username = sessionStorage.getItem('username');

  if (!userId || !username) {
    return null;
  }

  return { id: userId, username };
}

// Exponer las funciones globalmente
window.whatsappIntegration = {
  showWhatsAppLinkModal,
  linkWhatsAppNumber
};
