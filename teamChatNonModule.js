// Script no modular para el chat de equipo
// Este archivo proporciona compatibilidad con el resto de la aplicación

// Variables globales
window.teamChat = {
  currentUser: null,
  currentTeam: null,
  chatMessages: [],
  teamUsers: [],
  unreadMessages: 0,
  chatInitialized: false,
  chatSubscriptions: null,
  // Variables para controlar intervalos y timeouts
  reconnectTimeout: null,
  checkMessagesInterval: null,
  quickCheckInterval: null,
  heartbeatInterval: null,
  pollingInterval: null,
  quickPollingInterval: null,
  // Variables para controlar reconexiones
  reconnectAttempts: 0,
  lastReconnectTime: 0,
  reconnectInProgress: false,
  // Variable para evitar configuraciones simultáneas de polling
  pollingSetupInProgress: false,
  // Variable para controlar si se está mostrando la animación de carga
  loadingAnimationVisible: false
};

// Inicializar el chat
window.initializeTeamChat = async function(retryCount = 0) {
  try {
    console.log('Inicializando chat de equipo...');

    // Obtener información del usuario actual
    const userId = sessionStorage.getItem('userId');

    if (!userId) {
      console.error('No hay un usuario autenticado');

      // Si no hay usuario pero hay un intento de reconexión, esperar y reintentar
      if (retryCount < 3) {
        console.log(`No hay usuario autenticado, reintentando en 2 segundos (intento ${retryCount + 1}/3)...`);
        setTimeout(() => window.initializeTeamChat(retryCount + 1), 2000);
        return;
      }

      return;
    }

    // Verificar si Supabase está inicializado correctamente
    let supabase;
    try {
      // Intentar inicializar Supabase si es necesario
      if (typeof window.initSupabase === 'function') {
        await window.initSupabase();
      }

      supabase = window.getSupabaseClient();
      if (!supabase) {
        throw new Error('No se pudo obtener el cliente de Supabase');
      }

      // Verificar que la sesión sea válida
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw new Error(`Error al verificar sesión: ${sessionError.message}`);
      }

      if (!sessionData || !sessionData.session) {
        throw new Error('No hay sesión activa en Supabase');
      }

      console.log('Sesión de Supabase verificada correctamente');
    } catch (supabaseError) {
      console.error('Error con Supabase:', supabaseError);

      // Si hay un error de autenticación, intentar refrescar la sesión
      if (retryCount < 3) {
        console.log(`Error de Supabase, reintentando en 2 segundos (intento ${retryCount + 1}/3)...`);
        setTimeout(() => window.initializeTeamChat(retryCount + 1), 2000);
        return;
      }

      throw supabaseError;
    }

    // Obtener perfil del usuario
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error al obtener perfil del usuario:', userError);
      return;
    }

    console.log('Perfil de usuario obtenido:', userData);
    window.teamChat.currentUser = userData;

    // Verificar si el usuario tiene un team_id
    if (!userData.team_id) {
      // Intentar obtener el team_id del sessionStorage
      const teamId = sessionStorage.getItem('teamId');
      if (teamId) {
        console.log('Team ID obtenido del sessionStorage:', teamId);
        window.teamChat.currentTeam = teamId;
      } else {
        // Si no hay team_id, mostrar mensaje de error
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
          messagesContainer.innerHTML = `
            <div class="alert alert-warning">
              No estás asociado a ningún equipo. Por favor, únete a un equipo para usar el chat.
            </div>
          `;
        }
        console.error('El usuario no pertenece a un equipo');
        return;
      }
    } else {
      console.log('Team ID obtenido del perfil de usuario:', userData.team_id);
      window.teamChat.currentTeam = userData.team_id;
    }

    // Si no hay equipo, no continuar
    if (!window.teamChat.currentTeam) {
      console.error('El usuario no pertenece a un equipo');
      return;
    }

    // Cargar usuarios del equipo
    console.log('Cargando usuarios del equipo...');
    await window.loadTeamUsers();

    // Cargar mensajes
    console.log('Cargando mensajes del chat...');
    await window.loadChatMessages();

    // Configurar suscripciones en tiempo real
    console.log('Configurando suscripciones en tiempo real...');
    window.setupChatRealTimeSubscriptions();

    // Configurar eventos de la interfaz
    console.log('Configurando eventos de la interfaz...');
    window.setupChatUIEvents();

    // Marcar mensajes como leídos
    console.log('Marcando mensajes como leídos...');
    window.markAllChatMessagesAsRead();

    // Marcar como inicializado
    window.teamChat.chatInitialized = true;

    // Verificar que todo esté configurado correctamente
    console.log('Estado final del chat:');
    console.log('- Usuario actual:', window.teamChat.currentUser ? window.teamChat.currentUser.username : 'No definido');
    console.log('- Equipo actual:', window.teamChat.currentTeam);
    console.log('- Mensajes cargados:', window.teamChat.chatMessages.length);
    console.log('- Usuarios del equipo:', window.teamChat.teamUsers.length);
    console.log('- Suscripciones activas:', window.teamChat.chatSubscriptions ? 'Sí' : 'No');

    console.log('Chat inicializado correctamente');

    // Mostrar mensaje de bienvenida
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer && window.teamChat.chatMessages.length === 0) {
      const welcomeMessage = document.createElement('div');
      welcomeMessage.className = 'chat-system-message';
      welcomeMessage.innerHTML = `
        <div class="alert alert-info">
          <i class="fas fa-info-circle"></i> Bienvenido al chat de equipo. Aquí puedes comunicarte con los miembros de tu equipo.
        </div>
      `;
      messagesContainer.appendChild(welcomeMessage);
    }
  } catch (error) {
    console.error('Error al inicializar el chat:', error);

    // Mostrar mensaje de error al usuario
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle"></i> Error al inicializar el chat: ${error.message || 'Error desconocido'}
          <button class="btn btn-sm btn-outline-danger mt-2" onclick="window.initializeTeamChat()">Reintentar</button>
        </div>
      `;
    }
  }
};

// Cargar usuarios del equipo
window.loadTeamUsers = async function() {
  try {
    if (!window.teamChat.currentTeam) return;

    const supabase = window.getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, username, last_seen')
      .eq('team_id', window.teamChat.currentTeam);

    if (error) throw error;

    window.teamChat.teamUsers = data;
    window.renderChatUserList();
  } catch (error) {
    console.error('Error al cargar usuarios del equipo:', error);
  }
};

// Renderizar lista de usuarios
window.renderChatUserList = function() {
  const userListElement = document.getElementById('chatUserList');

  if (!userListElement || !window.teamChat.teamUsers.length) return;

  userListElement.innerHTML = '';

  window.teamChat.teamUsers.forEach(user => {
    const isOnline = window.isUserOnline(user.last_seen);
    const isCurrentUser = user.id === window.teamChat.currentUser.id;

    const userItem = document.createElement('li');
    userItem.className = 'chat-user-item';
    userItem.dataset.userId = user.id;

    // Obtener iniciales para el avatar
    const initials = user.username
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase();

    userItem.innerHTML = `
      <div class="chat-user-avatar">${initials}</div>
      <div class="chat-user-info">
        <div class="chat-user-name">${user.username} ${isCurrentUser ? '(Tú)' : ''}</div>
        <div class="chat-user-status ${isOnline ? 'online' : ''}">${isOnline ? 'En línea' : 'Desconectado'}</div>
      </div>
    `;

    userListElement.appendChild(userItem);
  });
};

// Verificar si un usuario está en línea
window.isUserOnline = function(lastSeen) {
  if (!lastSeen) return false;

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();

  // Considerar en línea si la última vez visto fue hace menos de 5 minutos
  return (now - lastSeenDate) < 5 * 60 * 1000;
};

// Bandera para controlar si estamos enviando un mensaje
window.teamChat.isSendingMessage = false;

// Cargar mensajes del chat
window.loadChatMessages = async function(retryCount = 0, skipLoadingAnimation = false) {
  try {
    // Si estamos enviando un mensaje, no mostrar la animación de carga
    if (window.teamChat.isSendingMessage) {
      skipLoadingAnimation = true;
    }

    // Verificar si tenemos un equipo asignado
    if (!window.teamChat.currentTeam) {
      console.error('No hay un equipo asignado para cargar mensajes');

      // Intentar obtener el equipo del usuario si está disponible
      if (window.teamChat.currentUser && window.teamChat.currentUser.team_id) {
        console.log('Usando team_id del perfil de usuario:', window.teamChat.currentUser.team_id);
        window.teamChat.currentTeam = window.teamChat.currentUser.team_id;
      } else {
        // Intentar obtener el team_id del sessionStorage
        const teamId = sessionStorage.getItem('teamId');
        if (teamId) {
          console.log('Usando team_id del sessionStorage:', teamId);
          window.teamChat.currentTeam = teamId;
        } else {
          console.error('No se pudo determinar el equipo para cargar mensajes');
          return;
        }
      }
    }

    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
      console.error('No se encontró el contenedor de mensajes');
      return;
    }

    // Solo mostrar la animación de carga si no estamos saltándola
    if (!skipLoadingAnimation) {
      // Si ya hay una animación de carga visible, no mostrar otra
      if (window.teamChat.loadingAnimationVisible) {
        console.log('Animación de carga ya visible, omitiendo...');
      } else {
        const loadingElement = messagesContainer.querySelector('.chat-loading');

        if (loadingElement) {
          loadingElement.style.display = 'block';
          window.teamChat.loadingAnimationVisible = true;
        } else {
          // Si no existe el elemento de carga, crearlo
          const loadingDiv = document.createElement('div');
          loadingDiv.className = 'chat-loading text-center py-4';
          loadingDiv.innerHTML = `
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-2">Cargando mensajes...</p>
          `;
          messagesContainer.innerHTML = '';
          messagesContainer.appendChild(loadingDiv);
          window.teamChat.loadingAnimationVisible = true;
        }
      }
    }

    // Verificar si Supabase está inicializado correctamente
    let supabase;
    try {
      // Intentar inicializar Supabase si es necesario
      if (typeof window.initSupabase === 'function') {
        await window.initSupabase();
      }

      supabase = window.getSupabaseClient();
      if (!supabase) {
        throw new Error('No se pudo obtener el cliente de Supabase');
      }

      // Verificar que la sesión sea válida
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw new Error(`Error al verificar sesión: ${sessionError.message}`);
      }

      if (!sessionData || !sessionData.session) {
        // Intentar refrescar la sesión
        console.log('No hay sesión activa, intentando refrescar...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData || !refreshData.session) {
          throw new Error('No hay sesión activa en Supabase y no se pudo refrescar');
        }
        console.log('Sesión refrescada correctamente');
      } else {
        console.log('Sesión de Supabase verificada correctamente');
      }
    } catch (supabaseError) {
      console.error('Error con Supabase:', supabaseError);

      // Si hay un error de autenticación, intentar refrescar la sesión
      if (retryCount < 3) {
        console.log(`Error de Supabase, reintentando en 2 segundos (intento ${retryCount + 1}/3)...`);
        setTimeout(() => window.loadChatMessages(retryCount + 1), 2000);
        return;
      }

      messagesContainer.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar mensajes: Problema de autenticación.
          <button class="btn btn-sm btn-outline-danger mt-2" onclick="window.loadChatMessages()">Reintentar</button>
          <button class="btn btn-sm btn-outline-primary mt-2" onclick="location.reload()">Recargar página</button>
        </div>
      `;

      // Resetear la bandera de animación de carga
      window.teamChat.loadingAnimationVisible = false;
      return;
    }

    // Verificar si la tabla existe
    try {
      console.log('Verificando tabla team_messages...');
      const { data: tableExists, error: tableError } = await supabase
        .from('team_messages')
        .select('id')
        .limit(1);

      if (tableError) {
        console.error('Error al verificar la tabla team_messages:', tableError);

        // Si es un error de autenticación, intentar refrescar la sesión
        if (tableError.code === 'PGRST301' || tableError.message.includes('JWT')) {
          console.log('Error de autenticación, intentando refrescar sesión...');
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (!error && data) {
              console.log('Sesión refrescada correctamente, reintentando...');
              setTimeout(() => window.loadChatMessages(retryCount), 500);
              return;
            }
          } catch (refreshError) {
            console.error('Error al refrescar sesión:', refreshError);
          }
        }

        throw new Error('La tabla team_messages no existe o no es accesible');
      }

      // Continuar con la carga de mensajes
      console.log('Cargando mensajes del equipo:', window.teamChat.currentTeam);
      const { data, error } = await supabase
        .from('team_messages')
        .select(`
          id,
          team_id,
          user_id,
          message,
          has_attachment,
          created_at,
          users:user_id (username)
        `)
        .eq('team_id', window.teamChat.currentTeam)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error al cargar mensajes:', error);

        // Si es un error de autenticación, intentar refrescar la sesión
        if (error.code === 'PGRST301' || error.message.includes('JWT')) {
          console.log('Error de autenticación, intentando refrescar sesión...');
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (!error && data) {
              console.log('Sesión refrescada correctamente, reintentando...');
              setTimeout(() => window.loadChatMessages(retryCount), 500);
              return;
            }
          } catch (refreshError) {
            console.error('Error al refrescar sesión:', refreshError);
          }
        }

        throw error;
      }

      console.log(`Se cargaron ${data ? data.length : 0} mensajes`);
      window.teamChat.chatMessages = data || [];

      // Limpiar el contenedor y quitar el indicador de carga
      messagesContainer.innerHTML = '';

      // Resetear la bandera de animación de carga
      window.teamChat.loadingAnimationVisible = false;

      // Si no hay mensajes, mostrar mensaje de bienvenida
      if (!data || data.length === 0) {
        messagesContainer.innerHTML = `
          <div class="chat-welcome-message">
            <div class="alert alert-info">
              <i class="fas fa-info-circle"></i> Bienvenido al chat de equipo. Aquí puedes comunicarte con los miembros de tu equipo.
            </div>
          </div>
        `;
      } else {
        // Renderizar mensajes
        window.renderChatMessages();
      }

      // Contar mensajes no leídos
      window.countUnreadChatMessages();

      // Guardar timestamp del último mensaje para comparaciones futuras
      if (data && data.length > 0) {
        const lastMessage = data[data.length - 1];
        const lastMessageTime = new Date(lastMessage.created_at).getTime();
        sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTime);
        console.log('Timestamp del último mensaje guardado:', new Date(lastMessageTime).toISOString());
      }

    } catch (tableCheckError) {
      console.error('Error al verificar la tabla:', tableCheckError);

      // Si es el primer intento, reintentar después de un breve retraso
      if (retryCount < 3) {
        console.log(`Reintentando cargar mensajes en 1 segundo (intento ${retryCount + 1}/3)...`);
        setTimeout(() => window.loadChatMessages(retryCount + 1), 1000);
        return;
      }

      messagesContainer.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar mensajes: La tabla de mensajes no existe o no es accesible. Por favor, contacta al administrador.
          <button class="btn btn-sm btn-outline-danger mt-2" onclick="window.loadChatMessages()">Reintentar</button>
        </div>
      `;

      // Resetear la bandera de animación de carga
      window.teamChat.loadingAnimationVisible = false;
    }
  } catch (error) {
    console.error('Error al cargar mensajes:', error);

    // Si es el primer intento, reintentar después de un breve retraso
    if (retryCount < 3) {
      console.log(`Reintentando cargar mensajes en 1 segundo (intento ${retryCount + 1}/3)...`);
      setTimeout(() => window.loadChatMessages(retryCount + 1), 1000);
      return;
    }

    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="alert alert-danger">
          Error al cargar mensajes: ${error.message || 'Error desconocido'}. Por favor, intenta nuevamente.
          <button class="btn btn-sm btn-outline-danger mt-2" onclick="window.loadChatMessages()">Reintentar</button>
        </div>
      `;

      // Resetear la bandera de animación de carga
      window.teamChat.loadingAnimationVisible = false;
    }
  }
};

// Formatear texto del mensaje
window.formatChatMessageText = function(text) {
  if (!text) return '';

  // Ocultar el texto "Archivo compartido:" en mensajes con archivos adjuntos
  if (text.startsWith('Archivo compartido:')) {
    return '';
  }

  // Escapar HTML para prevenir XSS
  let formattedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Procesar menciones (@usuario)
  formattedText = formattedText.replace(/@(\w+)/g, '<span class="chat-mention">@$1</span>');

  // Convertir URLs en enlaces
  formattedText = formattedText.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Procesar saltos de línea
  formattedText = formattedText.replace(/\n/g, '<br>');

  return formattedText;
};

// Renderizar mensajes
window.renderChatMessages = function() {
  try {
    const messagesContainer = document.getElementById('chatMessages');

    if (!messagesContainer) {
      console.error('No se encontró el contenedor de mensajes');
      return;
    }

    // Guardar la posición de desplazamiento actual
    const scrollPosition = messagesContainer.scrollTop;
    const wasAtBottom = (messagesContainer.scrollHeight - messagesContainer.scrollTop) <= (messagesContainer.clientHeight + 50);

    if (!window.teamChat.chatMessages || window.teamChat.chatMessages.length === 0) {
      messagesContainer.innerHTML = '<div class="text-center p-4">No hay mensajes aún. ¡Sé el primero en enviar uno!</div>';
      return;
    }

    console.log(`Renderizando ${window.teamChat.chatMessages.length} mensajes en el chat`);
    messagesContainer.innerHTML = '';

    // Ordenar mensajes por fecha
    const sortedMessages = [...window.teamChat.chatMessages].sort((a, b) => {
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Agrupar mensajes por fecha para mostrar separadores
    let currentDate = null;
    let lastUserId = null;

    sortedMessages.forEach((message, index) => {
      const isOutgoing = message.user_id === window.teamChat.currentUser.id;
      const username = message.users ? message.users.username : 'Usuario desconocido';
      const messageDate = new Date(message.created_at);
      const formattedTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formattedDate = messageDate.toLocaleDateString();

      // Añadir separador de fecha si cambia
      if (formattedDate !== currentDate) {
        currentDate = formattedDate;
        const dateSeparator = document.createElement('div');
        dateSeparator.className = 'chat-date-separator';
        dateSeparator.textContent = formattedDate;
        messagesContainer.appendChild(dateSeparator);
        // Resetear el último usuario al cambiar de día
        lastUserId = null;
      }

      // Determinar si este mensaje es parte de una secuencia del mismo usuario
      const isContinuation = message.user_id === lastUserId;
      lastUserId = message.user_id;

      const messageElement = document.createElement('div');
      messageElement.className = `chat-message ${isOutgoing ? 'outgoing' : 'incoming'} ${isContinuation ? 'continuation' : ''}`;
      messageElement.dataset.messageId = message.id;
      messageElement.dataset.userId = message.user_id;
      messageElement.dataset.timestamp = messageDate.getTime();

      // Estructura HTML diferente dependiendo de si es continuación
      if (isContinuation) {
        messageElement.innerHTML = `
          <div class="chat-message-content">
            <div class="chat-message-text">
              ${window.formatChatMessageText(message.message)}
              <span class="chat-message-time">${formattedTime}</span>
            </div>
            <div class="chat-reactions" data-message-id="${message.id}"></div>
          </div>
        `;
      } else {
        messageElement.innerHTML = `
          <div class="chat-message-content">
            <div class="chat-message-header">
              <span class="chat-message-username">${isOutgoing ? 'Tú' : username}</span>
            </div>
            <div class="chat-message-text">
              ${window.formatChatMessageText(message.message)}
              <span class="chat-message-time">${formattedTime}</span>
            </div>
            <div class="chat-reactions" data-message-id="${message.id}"></div>
          </div>
        `;
      }

      // Añadir evento para mostrar menú de reacciones
      messageElement.addEventListener('dblclick', (e) => {
        window.showChatReactionMenu(e, message.id);
      });

      messagesContainer.appendChild(messageElement);

      // Cargar reacciones para este mensaje
      window.loadChatMessageReactions(message.id);

      // Si tiene archivos adjuntos, cargarlos
      if (message.has_attachment) {
        window.loadChatMessageAttachments(message.id, messageElement);
      }

      // Si es el último mensaje y no es del usuario actual, marcarlo como leído
      if (index === sortedMessages.length - 1 && !isOutgoing) {
        window.markChatMessageAsRead(message.id);
      }
    });

    // Restaurar la posición de desplazamiento o ir al final si estaba al final
    if (wasAtBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      console.log('Desplazando al último mensaje (estaba al final)');
    } else {
      messagesContainer.scrollTop = scrollPosition;
      console.log('Restaurando posición de desplazamiento:', scrollPosition);
    }

    // Guardar timestamp del último mensaje para comparaciones futuras
    if (sortedMessages.length > 0) {
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const lastMessageTime = new Date(lastMessage.created_at).getTime();
      sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTime);
      console.log('Timestamp del último mensaje guardado:', new Date(lastMessageTime).toISOString());
    }

    // Verificar que el polling esté activo después de renderizar, pero solo si no hay polling activo
    setTimeout(() => {
      if (!window.teamChat.pollingInterval || !window.teamChat.quickPollingInterval) {
        console.log('Verificando sistema de polling después de renderizar mensajes...');
        // Evitar configurar polling si ya está en proceso
        if (!window.teamChat.pollingSetupInProgress) {
          window.setupChatRealTimeSubscriptions();
        }
      }
    }, 1000);
  } catch (error) {
    console.error('Error al renderizar mensajes:', error);
    // Intentar recuperarse del error
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="alert alert-danger">
          Error al renderizar mensajes: ${error.message || 'Error desconocido'}
          <button class="btn btn-sm btn-outline-danger mt-2" onclick="window.loadChatMessages()">Reintentar</button>
        </div>
      `;

      // Resetear la bandera de animación de carga
      window.teamChat.loadingAnimationVisible = false;
    }
  }
};

// Configurar eventos de la interfaz
window.setupChatUIEvents = function() {
  // Formulario de envío de mensajes
  const chatForm = document.getElementById('chatInputForm');
  if (chatForm) {
    chatForm.addEventListener('submit', window.handleChatMessageSubmit);
  }

  // Botón para adjuntar archivos
  const attachButton = document.getElementById('chatAttachBtn');
  const fileInput = document.getElementById('chatFileInput');

  if (attachButton && fileInput) {
    attachButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', window.handleChatFileAttachment);
  }

  // Botón para emojis
  const emojiButton = document.getElementById('chatEmojiBtn');
  if (emojiButton) {
    emojiButton.addEventListener('click', () => {
      emojiButton.classList.toggle('active');
    });
  }



  // Botón para alternar la barra lateral en móviles
  const sidebarToggle = document.getElementById('chatSidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.querySelector('.chat-sidebar');
      if (sidebar) {
        sidebar.classList.toggle('show');
      }
    });
  }

  // Cerrar la barra lateral al hacer clic fuera de ella en dispositivos móviles y tablets
  document.addEventListener('click', (event) => {
    // Verificar si estamos en un dispositivo móvil o tablet (ancho de pantalla <= 768px)
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.chat-sidebar');
      const sidebarToggle = document.getElementById('chatSidebarToggle');

      // Solo proceder si la barra lateral está visible
      if (sidebar && sidebar.classList.contains('show')) {
        // Verificar que el clic no fue dentro de la barra lateral ni en el botón de toggle
        if (!sidebar.contains(event.target) && (!sidebarToggle || !sidebarToggle.contains(event.target))) {
          // Cerrar la barra lateral
          sidebar.classList.remove('show');
          console.log('Barra lateral cerrada por clic fuera de ella');
        }
      }
    }
  });

  // También manejar eventos táctiles para dispositivos móviles
  document.addEventListener('touchend', (event) => {
    // Verificar si estamos en un dispositivo móvil o tablet (ancho de pantalla <= 768px)
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.chat-sidebar');
      const sidebarToggle = document.getElementById('chatSidebarToggle');

      // Solo proceder si la barra lateral está visible
      if (sidebar && sidebar.classList.contains('show')) {
        // Verificar que el toque no fue dentro de la barra lateral ni en el botón de toggle
        if (!sidebar.contains(event.target) && (!sidebarToggle || !sidebarToggle.contains(event.target))) {
          // Cerrar la barra lateral
          sidebar.classList.remove('show');
          console.log('Barra lateral cerrada por toque fuera de ella');
        }
      }
    }
  });

  // Búsqueda de usuarios
  const userSearchInput = document.getElementById('chatUserSearch');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', window.handleChatUserSearch);
  }

  // Auto-expandir textarea
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = (chatInput.scrollHeight) + 'px';
    });
  }
};

// Manejar envío de mensajes
window.handleChatMessageSubmit = async function(event) {
  event.preventDefault();

  const chatInput = document.getElementById('chatInput');
  if (!chatInput) {
    console.error('No se encontró el campo de entrada de mensajes');
    return;
  }

  const message = chatInput.value.trim();
  if (!message) return;

  // Deshabilitar el input mientras se envía el mensaje
  const originalValue = chatInput.value;
  chatInput.disabled = true;

  // Establecer la bandera de envío de mensaje para evitar animaciones de carga
  window.teamChat.isSendingMessage = true;

  // Guardar el timestamp actual para evitar recargas innecesarias
  const sendTime = new Date().getTime();
  sessionStorage.setItem('lastChatMessageTimestamp', sendTime);

  try {
    console.log('Enviando mensaje:', message);

    // Verificar que el usuario y el equipo estén definidos
    if (!window.teamChat.currentUser || !window.teamChat.currentTeam) {
      throw new Error('No hay un usuario autenticado o no pertenece a un equipo');
    }

    // Detectar menciones en el mensaje
    const mentionedUsers = window.detectChatMentions(message);

    // Enviar mensaje
    const supabase = window.getSupabaseClient();

    // Verificar si la tabla existe
    try {
      const { error: tableError } = await supabase
        .from('team_messages')
        .select('id')
        .limit(1);

      if (tableError) {
        console.error('Error al verificar la tabla team_messages:', tableError);
        throw new Error('La tabla team_messages no existe o no es accesible');
      }

      // Insertar el mensaje
      const { data, error } = await supabase
        .from('team_messages')
        .insert([
          {
            team_id: window.teamChat.currentTeam,
            user_id: window.teamChat.currentUser.id,
            message: message,
            has_attachment: false
          }
        ])
        .select();

      if (error) {
        console.error('Error al insertar mensaje en la base de datos:', error);
        throw error;
      }

      console.log('Mensaje enviado correctamente:', data);

      // Si hay menciones, registrarlas
      if (mentionedUsers.length > 0 && data && data.length > 0) {
        const messageId = data[0].id;
        console.log('Registrando menciones para usuarios:', mentionedUsers);

        // Verificar si la tabla de menciones existe
        try {
          const { error: mentionsTableError } = await supabase
            .from('message_mentions')
            .select('id')
            .limit(1);

          if (!mentionsTableError) {
            for (const userId of mentionedUsers) {
              await supabase
                .from('message_mentions')
                .insert([
                  {
                    message_id: messageId,
                    user_id: userId
                  }
                ]);
            }
            console.log('Menciones registradas correctamente');
          }
        } catch (mentionsError) {
          console.error('Error al registrar menciones:', mentionsError);
          // No interrumpir el flujo si falla el registro de menciones
        }
      }

      // Limpiar input
      chatInput.value = '';
      chatInput.style.height = 'auto';

      // Mostrar mensaje inmediatamente en la interfaz (no esperar a la suscripción)
      // Esto proporciona retroalimentación inmediata al usuario
      if (data && data.length > 0) {
        const newMessage = data[0];

        // Verificar si el mensaje ya está en la lista (por si la suscripción ya lo añadió)
        const existingMessage = window.teamChat.chatMessages.find(m => m.id === newMessage.id);
        if (!existingMessage) {
          console.log('Mostrando mensaje enviado inmediatamente en la interfaz');
          // Añadir el usuario al mensaje
          newMessage.users = { username: window.teamChat.currentUser.username };
          // Manejar el mensaje como si fuera recibido por la suscripción
          window.handleNewChatMessage(newMessage);

          // Actualizar el timestamp del último mensaje para evitar recargas innecesarias
          const lastMessageTime = new Date(newMessage.created_at).getTime();
          sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTime);
        }
      }
    } catch (tableCheckError) {
      console.error('Error al verificar la tabla:', tableCheckError);
      throw new Error('La tabla de mensajes no existe. Por favor, contacta al administrador.');
    }
  } catch (error) {
    console.error('Error al enviar mensaje:', error);

    // Restaurar el valor original si hay error
    chatInput.value = originalValue;

    // Mostrar mensaje de error
    const errorMessage = error.message || 'Error desconocido';
    alert(`Error al enviar mensaje: ${errorMessage}. Por favor, intenta nuevamente.`);
  } finally {
    // Habilitar el input nuevamente
    chatInput.disabled = false;

    // Restablecer la bandera de envío de mensaje después de un breve retraso
    // para evitar que el polling inmediato recargue los mensajes
    setTimeout(() => {
      window.teamChat.isSendingMessage = false;
    }, 5000); // Aumentamos el tiempo para asegurar que no haya recargas innecesarias
  }
};

// Detectar menciones en el mensaje
window.detectChatMentions = function(message) {
  const mentionedUserIds = [];

  // Buscar patrones @username en el mensaje
  const mentions = message.match(/@(\w+)/g);

  if (!mentions) return mentionedUserIds;

  // Convertir nombres de usuario a IDs
  mentions.forEach(mention => {
    const username = mention.substring(1); // Quitar el @

    const user = window.teamChat.teamUsers.find(u =>
      u.username.toLowerCase() === username.toLowerCase()
    );

    if (user && !mentionedUserIds.includes(user.id)) {
      mentionedUserIds.push(user.id);
    }
  });

  return mentionedUserIds;
};

// Asegurarse de que las variables de control estén inicializadas
window.teamChat.reconnectAttempts = window.teamChat.reconnectAttempts || 0;
window.teamChat.lastReconnectTime = window.teamChat.lastReconnectTime || 0;
window.teamChat.reconnectInProgress = window.teamChat.reconnectInProgress || false;
window.teamChat.reconnectTimeout = window.teamChat.reconnectTimeout || null;
window.teamChat.heartbeatInterval = window.teamChat.heartbeatInterval || null;

// Configurar sistema de polling para mensajes en lugar de suscripciones en tiempo real
window.setupChatRealTimeSubscriptions = async function() {
  console.log('Configurando sistema de polling para mensajes del chat...');

  // Evitar configuraciones simultáneas
  if (window.teamChat.pollingSetupInProgress) {
    console.log('Configuración de polling ya en progreso, omitiendo...');
    return;
  }

  // Marcar que estamos configurando el polling
  window.teamChat.pollingSetupInProgress = true;

  // Limpiar cualquier intervalo existente para evitar duplicados
  if (window.teamChat.pollingInterval) {
    clearInterval(window.teamChat.pollingInterval);
    window.teamChat.pollingInterval = null;
  }

  if (window.teamChat.quickPollingInterval) {
    clearInterval(window.teamChat.quickPollingInterval);
    window.teamChat.quickPollingInterval = null;
  }

  // Limpiar cualquier timeout pendiente
  if (window.teamChat.reconnectTimeout) {
    clearTimeout(window.teamChat.reconnectTimeout);
    window.teamChat.reconnectTimeout = null;
  }

  // Limpiar intervalos existentes para evitar duplicados
  if (window.teamChat.subscriptionCheckInterval) {
    clearInterval(window.teamChat.subscriptionCheckInterval);
    window.teamChat.subscriptionCheckInterval = null;
  }

  if (window.teamChat.heartbeatInterval) {
    clearInterval(window.teamChat.heartbeatInterval);
    window.teamChat.heartbeatInterval = null;
  }

  // Limpiar suscripciones anteriores si existen
  if (window.teamChat.chatSubscriptions) {
    try {
      if (window.teamChat.chatSubscriptions.messages) {
        window.teamChat.chatSubscriptions.messages.unsubscribe();
      }
      if (window.teamChat.chatSubscriptions.reactions) {
        window.teamChat.chatSubscriptions.reactions.unsubscribe();
      }
    } catch (unsubError) {
      console.error('Error al limpiar suscripciones anteriores:', unsubError);
    }
    window.teamChat.chatSubscriptions = null;
  }

  try {
    // Verificar si Supabase está inicializado correctamente
    if (typeof window.initSupabase === 'function') {
      await window.initSupabase();
    }

    // Verificar que la sesión sea válida
    const supabase = window.getSupabaseClient();
    if (!supabase) {
      throw new Error('No se pudo obtener el cliente de Supabase');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(`Error al verificar sesión: ${sessionError.message}`);
    }

    if (!sessionData || !sessionData.session) {
      // Intentar refrescar la sesión
      console.log('No hay sesión activa, intentando refrescar...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData || !refreshData.session) {
        throw new Error('No hay sesión activa en Supabase y no se pudo refrescar');
      }
      console.log('Sesión refrescada correctamente');
    } else {
      console.log('Sesión de Supabase verificada correctamente');
    }

    if (!window.teamChat.currentTeam) {
      console.error('No hay un equipo seleccionado para el polling');
      return;
    }

    // Cargar mensajes iniciales (solo si no estamos enviando un mensaje)
    if (!window.teamChat.isSendingMessage) {
      await window.loadChatMessages(0, false);
    }

    // Almacenar el timestamp del último mensaje para comparaciones
    let lastMessageTimestamp = parseInt(sessionStorage.getItem('lastChatMessageTimestamp') || '0');

    // Configurar intervalo de polling principal (cada 5 segundos)
    window.teamChat.pollingInterval = setInterval(async () => {
      try {
        // No realizar polling si estamos enviando un mensaje
        if (window.teamChat.isSendingMessage) {
          console.log('Omitiendo polling durante envío de mensaje');
          return;
        }

        // Solo realizar polling si la página del chat está visible o si estamos en segundo plano
        const chatPage = document.getElementById('teamchat');
        const isVisible = chatPage && !chatPage.classList.contains('hidden');

        // Obtener los mensajes más recientes
        const { data, error } = await supabase
          .from('team_messages')
          .select('id, created_at, user_id, message, has_attachment')
          .eq('team_id', window.teamChat.currentTeam)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error al obtener mensajes recientes:', error);
          return;
        }

        if (data && data.length > 0) {
          // Verificar si hay mensajes nuevos
          const newestMessageTimestamp = new Date(data[0].created_at).getTime();

          if (newestMessageTimestamp > lastMessageTimestamp) {
            console.log('Se detectaron nuevos mensajes en polling:', newestMessageTimestamp, '>', lastMessageTimestamp);

            // Si la página de chat no está visible, solo incrementar contador
            if (!isVisible) {
              console.log('Chat no visible, incrementando contador de no leídos');
              window.incrementChatUnreadCount();
            } else {
              // Si la página está visible, cargar los mensajes nuevos sin mostrar animación
              console.log('Chat visible, recargando mensajes sin animación');
              await window.loadChatMessages(0, true);
            }

            // Actualizar timestamp del último mensaje
            lastMessageTimestamp = newestMessageTimestamp;
            sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTimestamp);
          }
        }
      } catch (e) {
        console.error('Error en polling de mensajes:', e);
      }
    }, 5000);

    // Configurar intervalo de polling rápido cuando el chat está visible (cada 2 segundos)
    window.teamChat.quickPollingInterval = setInterval(async () => {
      try {
        // No realizar polling si estamos enviando un mensaje
        if (window.teamChat.isSendingMessage) {
          console.log('Omitiendo polling durante envío de mensaje');
          return;
        }

        // Solo realizar polling rápido si la página del chat está visible
        const chatPage = document.getElementById('teamchat');
        if (!chatPage || chatPage.classList.contains('hidden')) {
          return;
        }

        // Obtener solo el mensaje más reciente
        const { data, error } = await supabase
          .from('team_messages')
          .select('id, created_at, user_id')
          .eq('team_id', window.teamChat.currentTeam)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error en polling rápido:', error);
          return;
        }

        if (data && data.length > 0) {
          // Verificar si hay mensajes nuevos
          const newestMessageTimestamp = new Date(data[0].created_at).getTime();
          const isOwnMessage = data[0].user_id === window.teamChat.currentUser.id;

          // Solo recargar si hay mensajes nuevos Y no son del usuario actual
          // Esto evita el refresco innecesario cuando el usuario envía un mensaje
          if (newestMessageTimestamp > lastMessageTimestamp && !isOwnMessage) {
            console.log('Se detectaron nuevos mensajes en polling rápido de otro usuario');
            // Cargar mensajes sin mostrar animación de carga
            await window.loadChatMessages(0, true);

            // Actualizar timestamp del último mensaje
            lastMessageTimestamp = newestMessageTimestamp;
            sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTimestamp);
          } else if (newestMessageTimestamp > lastMessageTimestamp) {
            // Si es un mensaje propio, solo actualizar el timestamp sin recargar
            console.log('Se detectó mensaje propio, actualizando timestamp sin recargar');
            lastMessageTimestamp = newestMessageTimestamp;
            sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTimestamp);
          }
        }
      } catch (e) {
        console.error('Error en polling rápido de mensajes:', e);
      }
    }, 2000);

    console.log('Sistema de polling configurado correctamente');

    // Marcar que hemos terminado de configurar el polling
    window.teamChat.pollingSetupInProgress = false;

  } catch (error) {
    console.error('Error al configurar sistema de polling:', error);

    // Como fallback inmediato, intentar cargar mensajes manualmente
    try {
      window.loadChatMessages(0, true);
    } catch (loadError) {
      console.error('Error al intentar cargar mensajes como fallback:', loadError);
    }

    // Marcar que hemos terminado de configurar el polling (incluso con error)
    window.teamChat.pollingSetupInProgress = false;

    // Programar un reintento después de un tiempo
    window.teamChat.reconnectTimeout = setTimeout(() => {
      window.setupChatRealTimeSubscriptions();
    }, 10000);
  }
};

// Obtener filtro de IDs de mensajes para suscripciones
window.getChatMessageIdsFilter = function() {
  if (!window.teamChat.chatMessages.length) return '00000000-0000-0000-0000-000000000000';

  return window.teamChat.chatMessages
    .map(msg => msg.id)
    .join(',');
};

// Manejar nuevo mensaje recibido
window.handleNewChatMessage = async function(message) {
  try {
    console.log('Procesando nuevo mensaje recibido:', message);
    console.log('ID del mensaje:', message.id);
    console.log('Usuario del mensaje:', message.user_id);
    console.log('Usuario actual:', window.teamChat.currentUser ? window.teamChat.currentUser.id : 'No definido');
    console.log('Timestamp del mensaje:', message.created_at);

    // Verificar si el mensaje ya existe en la lista (para evitar duplicados)
    const existingMessageIndex = window.teamChat.chatMessages.findIndex(m => m.id === message.id);
    if (existingMessageIndex >= 0) {
      console.log('Mensaje ya existe en la lista, ignorando duplicado');
      return;
    }

    // Si el mensaje es del usuario actual y estamos en modo de envío, actualizar el timestamp
    // y establecer una bandera para evitar recargas innecesarias
    const isOwnMessage = message.user_id === window.teamChat.currentUser.id;
    if (isOwnMessage && window.teamChat.isSendingMessage) {
      const lastMessageTime = new Date(message.created_at).getTime();
      sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTime);
      // Extender el tiempo de la bandera de envío para evitar recargas
      setTimeout(() => {
        window.teamChat.isSendingMessage = false;
      }, 3000);
    }

    // Obtener información del usuario que envió el mensaje
    const supabase = window.getSupabaseClient();
    if (!supabase) {
      console.error('No se pudo obtener el cliente de Supabase');
      return;
    }

    // Intentar obtener datos del usuario del mensaje
    let userData = null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', message.user_id)
        .single();

      if (error) {
        console.error('Error al obtener datos del usuario:', error);
        // Intentar continuar con información limitada
      } else {
        userData = data;
      }
    } catch (userError) {
      console.error('Error en consulta de usuario:', userError);
    }

    console.log('Datos de usuario obtenidos:', userData);

    // Añadir el mensaje a la lista
    const enrichedMessage = {
      ...message,
      users: userData || { username: 'Usuario' }
    };

    // Insertar el mensaje en la posición correcta según su timestamp
    let inserted = false;
    if (window.teamChat.chatMessages.length > 0) {
      for (let i = 0; i < window.teamChat.chatMessages.length; i++) {
        const msgDate = new Date(window.teamChat.chatMessages[i].created_at);
        const newMsgDate = new Date(message.created_at);

        if (newMsgDate < msgDate) {
          window.teamChat.chatMessages.splice(i, 0, enrichedMessage);
          inserted = true;
          console.log('Mensaje insertado en posición cronológica:', i);
          break;
        }
      }
    }

    if (!inserted) {
      window.teamChat.chatMessages.push(enrichedMessage);
      console.log('Mensaje añadido al final de la lista');
    }

    console.log('Total mensajes:', window.teamChat.chatMessages.length);

    // Verificar si debemos renderizar todos los mensajes o solo añadir este
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) {
      console.error('No se encontró el contenedor de mensajes');
      return;
    }

    // Si el mensaje es muy antiguo o está en medio de la conversación, renderizar todo
    // Pero solo si no es un mensaje propio que acabamos de enviar
    if (inserted && window.teamChat.chatMessages.length > 1 && !isOwnMessage) {
      console.log('Mensaje insertado en medio de la conversación, renderizando todos los mensajes');
      window.renderChatMessages();
      return;
    }

    // Continuar con la adición del mensaje individual
    const isOutgoing = isOwnMessage;
    const username = userData ? userData.username : 'Usuario';
    const messageDate = new Date(message.created_at);
    const formattedTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedDate = messageDate.toLocaleDateString();

    // Verificar si necesitamos añadir un separador de fecha
    // Buscar todos los separadores de fecha existentes
    const dateSeparators = messagesContainer.querySelectorAll('.chat-date-separator');
    let needNewSeparator = true;

    // Verificar si ya existe un separador para esta fecha
    for (let i = 0; i < dateSeparators.length; i++) {
      if (dateSeparators[i].textContent === formattedDate) {
        needNewSeparator = false;
        break;
      }
    }

    // Solo añadir un nuevo separador si es necesario
    if (needNewSeparator) {
      const dateSeparator = document.createElement('div');
      dateSeparator.className = 'chat-date-separator';
      dateSeparator.textContent = formattedDate;
      messagesContainer.appendChild(dateSeparator);
      console.log('Añadido separador de fecha:', formattedDate);
    }

    // Verificar si este mensaje es una continuación de mensajes del mismo usuario
    // Buscar el último mensaje real, no solo el último elemento
    let lastMessageElement = null;
    const messageElements = messagesContainer.querySelectorAll('.chat-message');
    if (messageElements.length > 0) {
      lastMessageElement = messageElements[messageElements.length - 1];
    }

    const isContinuation = lastMessageElement &&
                          lastMessageElement.dataset.userId === message.user_id;

    console.log('¿Es continuación de mensajes del mismo usuario?', isContinuation);

    // Crear el elemento del mensaje
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOutgoing ? 'outgoing' : 'incoming'} ${isContinuation ? 'continuation' : ''}`;
    messageElement.dataset.messageId = message.id;
    messageElement.dataset.userId = message.user_id;
    messageElement.dataset.timestamp = messageDate.getTime();

    // Estructura HTML diferente dependiendo de si es continuación
    if (isContinuation) {
      messageElement.innerHTML = `
        <div class="chat-message-content">
          <div class="chat-message-text">
            ${window.formatChatMessageText(message.message)}
            <span class="chat-message-time">${formattedTime}</span>
          </div>
          <div class="chat-reactions" data-message-id="${message.id}"></div>
        </div>
      `;
    } else {
      messageElement.innerHTML = `
        <div class="chat-message-content">
          <div class="chat-message-header">
            <span class="chat-message-username">${isOutgoing ? 'Tú' : username}</span>
          </div>
          <div class="chat-message-text">
            ${window.formatChatMessageText(message.message)}
            <span class="chat-message-time">${formattedTime}</span>
          </div>
          <div class="chat-reactions" data-message-id="${message.id}"></div>
        </div>
      `;
    }

    // Añadir evento para mostrar menú de reacciones
    messageElement.addEventListener('dblclick', (e) => {
      window.showChatReactionMenu(e, message.id);
    });

    messagesContainer.appendChild(messageElement);
    console.log('Elemento de mensaje añadido al DOM');

    // Desplazar al último mensaje
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    console.log('Desplazando al último mensaje');

    // Si el mensaje no es del usuario actual, marcarlo como no leído
    if (!isOutgoing) {
      window.incrementChatUnreadCount();
      console.log('Contador de mensajes no leídos incrementado');

      // Si la página de chat está activa, marcar como leído
      if (document.getElementById('teamchat') && !document.getElementById('teamchat').classList.contains('hidden')) {
        console.log('Página de chat activa, marcando mensaje como leído');
        window.markChatMessageAsRead(message.id);
      }
    }

    // Si tiene archivos adjuntos, cargarlos
    if (message.has_attachment) {
      console.log('Mensaje tiene archivos adjuntos, cargando...');
      window.loadChatMessageAttachments(message.id, messageElement);
    }

    // Reproducir sonido de notificación para mensajes entrantes (no propios)
    if (!isOutgoing) {
      try {
        const notificationSound = new Audio('/assets/sounds/notification.mp3');
        notificationSound.volume = 0.5;
        notificationSound.play().catch(e => console.log('No se pudo reproducir sonido de notificación:', e));
      } catch (soundError) {
        console.log('Error al reproducir sonido de notificación:', soundError);
      }

      // Mostrar notificación del sistema si está permitido y la página no está activa
      if ('Notification' in window && Notification.permission === 'granted') {
        if (document.hidden || !document.getElementById('teamchat') || document.getElementById('teamchat').classList.contains('hidden')) {
          try {
            const notification = new Notification('Nuevo mensaje', {
              body: `${username}: ${message.message.substring(0, 50)}${message.message.length > 50 ? '...' : ''}`,
              icon: '/assets/images/logo.png'
            });

            notification.onclick = function() {
              window.focus();
              const chatLink = document.querySelector('.nav-link[data-page="teamchat"]');
              if (chatLink) chatLink.click();
            };
          } catch (notifError) {
            console.log('Error al mostrar notificación:', notifError);
          }
        }
      }
    }

    // Guardar timestamp del último mensaje para comparaciones futuras
    const lastMessageTime = new Date(message.created_at).getTime();
    const currentLastTime = parseInt(sessionStorage.getItem('lastChatMessageTimestamp') || '0');

    if (lastMessageTime > currentLastTime) {
      sessionStorage.setItem('lastChatMessageTimestamp', lastMessageTime);
      console.log('Actualizado timestamp del último mensaje:', new Date(lastMessageTime).toISOString());
    }

    // Verificar que el polling esté activo después de recibir un mensaje
    if (!window.teamChat.pollingInterval || !window.teamChat.quickPollingInterval) {
      console.log('Polling no encontrado después de recibir mensaje, reconfigurando...');
      window.setupChatRealTimeSubscriptions();
    }
  } catch (error) {
    console.error('Error al procesar nuevo mensaje:', error);

    // Intentar recargar los mensajes en caso de error
    try {
      console.log('Intentando recargar mensajes después de error...');
      setTimeout(() => window.loadChatMessages(), 2000);
    } catch (reloadError) {
      console.error('Error al intentar recargar mensajes:', reloadError);
    }
  }
};

// Incrementar contador de mensajes no leídos
window.incrementChatUnreadCount = function() {
  window.teamChat.unreadMessages++;
  window.updateChatUnreadBadge();
};

// Actualizar badge de mensajes no leídos
window.updateChatUnreadBadge = function() {
  const badge = document.getElementById('chatUnreadBadge');

  if (!badge) return;

  if (window.teamChat.unreadMessages > 0) {
    badge.textContent = window.teamChat.unreadMessages > 99 ? '99+' : window.teamChat.unreadMessages;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
};

// Contar mensajes no leídos
window.countUnreadChatMessages = async function() {
  try {
    if (!window.teamChat.currentTeam || !window.teamChat.currentUser) {
      console.log('No hay usuario o equipo para contar mensajes no leídos');
      return;
    }

    const supabase = window.getSupabaseClient();
    if (!supabase) {
      console.error('No se pudo obtener el cliente de Supabase');
      return;
    }

    // Verificar si las tablas existen
    try {
      // Verificar tabla team_messages
      const { error: messagesTableError } = await supabase
        .from('team_messages')
        .select('id')
        .limit(1);

      if (messagesTableError) {
        console.error('Error al verificar la tabla team_messages:', messagesTableError);
        return;
      }

      // Verificar tabla message_reads
      const { error: readsTableError } = await supabase
        .from('message_reads')
        .select('id')
        .limit(1);

      if (readsTableError) {
        console.error('Error al verificar la tabla message_reads:', readsTableError);
        // Si la tabla no existe, simplemente establecer unreadMessages a 0
        window.teamChat.unreadMessages = 0;
        window.updateChatUnreadBadge();
        return;
      }

      // Obtener mensajes no leídos
      try {
        // Primero, obtener todos los mensajes del equipo que no son del usuario actual
        const { data: teamMessages, error: teamMessagesError } = await supabase
          .from('team_messages')
          .select('id')
          .eq('team_id', window.teamChat.currentTeam)
          .not('user_id', 'eq', window.teamChat.currentUser.id);

        if (teamMessagesError) throw teamMessagesError;

        if (!teamMessages || teamMessages.length === 0) {
          // No hay mensajes de otros usuarios
          window.teamChat.unreadMessages = 0;
          window.updateChatUnreadBadge();
          return;
        }

        // Obtener los mensajes que el usuario ya ha leído
        const { data: readMessages, error: readMessagesError } = await supabase
          .from('message_reads')
          .select('message_id')
          .eq('user_id', window.teamChat.currentUser.id);

        if (readMessagesError) throw readMessagesError;

        // Convertir a conjunto para búsqueda eficiente
        const readMessageIds = new Set(readMessages ? readMessages.map(m => m.message_id) : []);

        // Contar mensajes no leídos
        const unreadCount = teamMessages.filter(msg => !readMessageIds.has(msg.id)).length;

        window.teamChat.unreadMessages = unreadCount;
        window.updateChatUnreadBadge();
      } catch (queryError) {
        console.error('Error al consultar mensajes no leídos:', queryError);
        // En caso de error, no actualizar el contador
      }
    } catch (tableCheckError) {
      console.error('Error al verificar tablas:', tableCheckError);
    }
  } catch (error) {
    console.error('Error al contar mensajes no leídos:', error);
  }
};

// Marcar todos los mensajes como leídos
window.markAllChatMessagesAsRead = async function() {
  try {
    if (!window.teamChat.currentTeam || !window.teamChat.currentUser) {
      console.log('No hay usuario o equipo para marcar mensajes como leídos');
      return;
    }

    const supabase = window.getSupabaseClient();
    if (!supabase) {
      console.error('No se pudo obtener el cliente de Supabase');
      return;
    }

    // Verificar si las tablas existen
    try {
      // Verificar tabla team_messages
      const { error: messagesTableError } = await supabase
        .from('team_messages')
        .select('id')
        .limit(1);

      if (messagesTableError) {
        console.error('Error al verificar la tabla team_messages:', messagesTableError);
        return;
      }

      // Verificar tabla message_reads
      const { error: readsTableError } = await supabase
        .from('message_reads')
        .select('id')
        .limit(1);

      if (readsTableError) {
        console.error('Error al verificar la tabla message_reads:', readsTableError);
        return;
      }

      // Obtener IDs de mensajes no leídos
      const { data: unreadData, error: unreadError } = await supabase
        .from('team_messages')
        .select('id')
        .eq('team_id', window.teamChat.currentTeam)
        .not('user_id', 'eq', window.teamChat.currentUser.id);

      if (unreadError) throw unreadError;

      if (!unreadData || unreadData.length === 0) {
        console.log('No hay mensajes no leídos para marcar');
        window.teamChat.unreadMessages = 0;
        window.updateChatUnreadBadge();
        return;
      }

      // Obtener mensajes ya leídos
      const { data: readData, error: readError } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', window.teamChat.currentUser.id);

      if (readError) throw readError;

      // Convertir a conjunto para búsqueda eficiente
      const readMessageIds = new Set(readData ? readData.map(m => m.message_id) : []);

      // Filtrar mensajes que aún no han sido leídos
      const messagesToMark = unreadData.filter(msg => !readMessageIds.has(msg.id));

      if (messagesToMark.length === 0) {
        console.log('Todos los mensajes ya están marcados como leídos');
        window.teamChat.unreadMessages = 0;
        window.updateChatUnreadBadge();
        return;
      }

      console.log(`Marcando ${messagesToMark.length} mensajes como leídos...`);

      // Preparar datos para inserción masiva
      const readEntries = messagesToMark.map(msg => ({
        message_id: msg.id,
        user_id: window.teamChat.currentUser.id
      }));

      // Insertar en lotes de 10 para evitar problemas
      const batchSize = 10;
      for (let i = 0; i < readEntries.length; i += batchSize) {
        const batch = readEntries.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('message_reads')
          .insert(batch);

        if (insertError) {
          console.error('Error al insertar lote de lecturas:', insertError);
          // Continuar con el siguiente lote
        }
      }

      // Actualizar contador
      window.teamChat.unreadMessages = 0;
      window.updateChatUnreadBadge();

      console.log('Todos los mensajes han sido marcados como leídos');
    } catch (tableCheckError) {
      console.error('Error al verificar tablas:', tableCheckError);
    }
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
  }
};

// Marcar un mensaje como leído
window.markChatMessageAsRead = async function(messageId) {
  try {
    if (!messageId) {
      console.error('ID de mensaje no válido');
      return;
    }

    if (!window.teamChat.currentUser) {
      console.error('No hay un usuario autenticado');
      return;
    }

    const supabase = window.getSupabaseClient();
    if (!supabase) {
      console.error('No se pudo obtener el cliente de Supabase');
      return;
    }

    // Verificar si la tabla message_reads existe
    try {
      const { error: tableError } = await supabase
        .from('message_reads')
        .select('id')
        .limit(1);

      if (tableError) {
        console.error('Error al verificar la tabla message_reads:', tableError);
        return;
      }

      // Verificar si ya está marcado como leído
      const { data: existingRead, error: checkError } = await supabase
        .from('message_reads')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', window.teamChat.currentUser.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error al verificar si el mensaje ya está leído:', checkError);
        return;
      }

      // Si ya está marcado, no hacer nada
      if (existingRead) {
        console.log(`Mensaje ${messageId} ya está marcado como leído`);
        return;
      }

      // Marcar como leído
      const { error } = await supabase
        .from('message_reads')
        .insert([
          {
            message_id: messageId,
            user_id: window.teamChat.currentUser.id
          }
        ]);

      if (error) {
        console.error('Error al insertar registro de lectura:', error);
        return;
      }

      console.log(`Mensaje ${messageId} marcado como leído`);
    } catch (tableCheckError) {
      console.error('Error al verificar tabla:', tableCheckError);
    }
  } catch (error) {
    console.error('Error al marcar mensaje como leído:', error);
  }
};

// Solicitar permisos de notificación
window.requestNotificationPermission = function() {
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        console.log('Permiso de notificación:', permission);
        if (permission === 'granted') {
          try {
            const notification = new Notification('Notificaciones activadas', {
              body: 'Ahora recibirás notificaciones cuando lleguen nuevos mensajes.',
              icon: '/assets/images/logo.png'
            });

            setTimeout(() => notification.close(), 5000);
          } catch (e) {
            console.log('Error al mostrar notificación de prueba:', e);
          }
        }
      });
    }
  }
};

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Configurando eventos del chat...');

  // Inicializar Supabase primero
  try {
    if (typeof window.initSupabase === 'function') {
      console.log('Inicializando Supabase al cargar la página...');
      await window.initSupabase();
      console.log('Supabase inicializado correctamente');
    }
  } catch (supabaseError) {
    console.error('Error al inicializar Supabase:', supabaseError);
  }

  // Función para verificar la autenticación y configurar el chat
  const setupChatIfAuthenticated = async () => {
    // Verificar si el usuario está autenticado
    const userId = sessionStorage.getItem('userId');

    if (userId) {
      console.log('Usuario autenticado, configurando eventos del chat');

      // Verificar que la sesión de Supabase sea válida
      try {
        const supabase = window.getSupabaseClient();
        if (supabase && supabase.auth) {
          console.log('Verificando sesión de Supabase...');
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('Error al verificar sesión:', sessionError);
            throw sessionError;
          }

          if (!sessionData || !sessionData.session) {
            console.log('No hay sesión activa en Supabase, intentando refrescar...');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError || !refreshData || !refreshData.session) {
              console.error('No se pudo refrescar la sesión:', refreshError);
              throw new Error('No hay sesión activa y no se pudo refrescar');
            }

            console.log('Sesión refrescada correctamente');
          } else {
            console.log('Sesión de Supabase verificada correctamente');
          }
        }
      } catch (authError) {
        console.error('Error de autenticación:', authError);
        // Continuar de todos modos, pero registrar el error
      }

      // Solicitar permisos de notificación
      window.requestNotificationPermission();

      // Inicializar chat cuando se muestra la página
      const chatLink = document.querySelector('.nav-link[data-page="teamchat"]');

      if (chatLink) {
        chatLink.addEventListener('click', () => {
          console.log('Navegando a la página de chat');

          // Inicializar chat si no se ha hecho
          if (!window.teamChat.chatInitialized) {
            console.log('Inicializando chat por primera vez');
            window.initializeTeamChat();
          } else {
            console.log('Chat ya inicializado, actualizando mensajes');
            // Recargar mensajes para mantener actualizado sin mostrar animación de carga
            window.loadChatMessages(0, true);

            // Verificar que las suscripciones en tiempo real estén activas
            if (!window.teamChat.chatSubscriptions ||
                !window.teamChat.chatSubscriptions.messages) {
              console.log('Suscripciones no encontradas, reconfigurando...');
              window.setupChatRealTimeSubscriptions();
            }
          }

          // Marcar mensajes como leídos
          window.markAllChatMessagesAsRead();
        });

        console.log('Eventos del chat configurados correctamente');
      } else {
        console.error('No se encontró el enlace al chat en la navegación');
      }

      // También inicializar cuando se carga directamente la página de chat
      setTimeout(() => {
        const chatPage = document.getElementById('teamchat');
        if (chatPage && !chatPage.classList.contains('hidden')) {
          console.log('Página de chat visible al cargar, inicializando...');
          if (!window.teamChat.chatInitialized) {
            window.initializeTeamChat();
          } else {
            // Si ya está inicializado, actualizar mensajes sin mostrar animación
            window.loadChatMessages(0, true);
          }
        }
      }, 1000); // Aumentado a 1000ms para dar más tiempo a la autenticación

    // Verificar periódicamente que el polling esté activo
    // Limpiar cualquier intervalo existente para evitar duplicados
    if (window.teamChat.checkMessagesInterval) {
      clearInterval(window.teamChat.checkMessagesInterval);
    }

    window.teamChat.checkMessagesInterval = setInterval(() => {
      if (window.teamChat.chatInitialized && window.teamChat.currentTeam) {
        const chatPage = document.getElementById('teamchat');

        // Verificar que los intervalos de polling estén activos
        if (chatPage && !chatPage.classList.contains('hidden')) {
          if (!window.teamChat.pollingInterval || !window.teamChat.quickPollingInterval) {
            console.log('Verificación periódica: polling no encontrado, reconfigurando...');

            // Evitar reconexiones demasiado frecuentes
            const now = Date.now();
            if (now - window.teamChat.lastReconnectTime > 30000) {
              try {
                window.setupChatRealTimeSubscriptions();
              } catch (error) {
                console.error('Error al reconfigurar polling:', error);
              }
            } else {
              console.log('Esperando antes de reconfigurar polling para evitar reconexiones frecuentes');
            }
          }
        }
      }
    }, 30000); // Verificar cada 30 segundos

    return true; // Indica que se configuró correctamente
    } else {
      console.log('Usuario no autenticado, no se configuran eventos del chat');
      return false; // Indica que no se pudo configurar
    }
  };

  // Intentar configurar inmediatamente
  try {
    let configured = await setupChatIfAuthenticated();

    // Si no se pudo configurar, intentar nuevamente después de un tiempo
    if (!configured) {
      console.log('Programando reintento de configuración del chat en 1 segundo...');
      setTimeout(async () => {
        try {
          if (!configured) {
            console.log('Reintentando configuración del chat...');
            configured = await setupChatIfAuthenticated();

            // Si aún no se pudo configurar, intentar una última vez
            if (!configured) {
              console.log('Programando último intento de configuración del chat en 2 segundos...');
              setTimeout(async () => {
                try {
                  console.log('Último intento de configuración del chat...');
                  await setupChatIfAuthenticated();
                } catch (finalError) {
                  console.error('Error en el último intento de configuración del chat:', finalError);
                }
              }, 2000);
            }
          }
        } catch (retryError) {
          console.error('Error en el reintento de configuración del chat:', retryError);
        }
      }, 1000);
    }
  } catch (initialError) {
    console.error('Error en la configuración inicial del chat:', initialError);
  }
});
