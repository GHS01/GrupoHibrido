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
  }

  // Mostrar el modal
  const modal = document.getElementById('whatsappLinkModal');
  modal.style.display = 'block';

  // Cargar el número de teléfono actual del usuario si existe
  loadUserPhoneNumber();
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
      const evolutionApiUrl = 'http://localhost:8080/api/v1';
      const evolutionApiInstance = 'ghs';
      const evolutionApiToken = '0DC6168A59D5-416C-B4CA-9ADE525EEA5E';

      const response = await fetch(`${evolutionApiUrl}/message/text/${evolutionApiInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiToken
        },
        body: JSON.stringify({
          number: phoneNumber,
          options: {
            delay: 1200
          },
          textMessage: {
            text: "Este es un mensaje de prueba de Finance Pro. Si recibe este mensaje, la conexión con WhatsApp está funcionando correctamente."
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error en la respuesta de Evolution API:', errorData);
        throw new Error(`Error en Evolution API: ${response.status} ${response.statusText}`);
      }
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
