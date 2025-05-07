// Funcionalidad básica del chat de equipo
import { getSupabaseClient } from './supabaseConfig.js';

// Variables globales
let currentUser = null;
let currentTeam = null;
let chatMessages = [];
let teamUsers = [];
let unreadMessages = 0;

// Inicializar el chat
async function initializeChat() {
  try {
    // Obtener información del usuario actual
    currentUser = await getCurrentUser();

    if (!currentUser || !currentUser.teamId) {
      console.error('No hay un usuario autenticado o no pertenece a un equipo');
      return;
    }

    currentTeam = currentUser.teamId;

    // Cargar usuarios del equipo
    await loadTeamUsers();

    // Cargar mensajes
    await loadMessages();

    // Configurar suscripciones en tiempo real
    setupRealTimeSubscriptions();

    // Configurar eventos de la interfaz
    setupUIEvents();

    // Marcar mensajes como leídos
    markAllMessagesAsRead();

    console.log('Chat inicializado correctamente');
  } catch (error) {
    console.error('Error al inicializar el chat:', error);
  }
}

// Obtener el usuario actual
async function getCurrentUser() {
  try {
    const userId = sessionStorage.getItem('userId');

    if (!userId) {
      return null;
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error al obtener el usuario actual:', error);
    return null;
  }
}

// Cargar usuarios del equipo
async function loadTeamUsers() {
  try {
    if (!currentTeam) return;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, username, last_seen')
      .eq('team_id', currentTeam);

    if (error) throw error;

    teamUsers = data;
    renderUserList();
  } catch (error) {
    console.error('Error al cargar usuarios del equipo:', error);
  }
}

// Renderizar lista de usuarios
function renderUserList() {
  const userListElement = document.getElementById('chatUserList');

  if (!userListElement || !teamUsers.length) return;

  userListElement.innerHTML = '';

  teamUsers.forEach(user => {
    const isOnline = isUserOnline(user.last_seen);
    const isCurrentUser = user.id === currentUser.id;

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
}

// Verificar si un usuario está en línea
function isUserOnline(lastSeen) {
  if (!lastSeen) return false;

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();

  // Considerar en línea si la última vez visto fue hace menos de 5 minutos
  return (now - lastSeenDate) < 5 * 60 * 1000;
}

// Cargar mensajes del chat
async function loadMessages() {
  try {
    if (!currentTeam) return;

    const messagesContainer = document.getElementById('chatMessages');
    const loadingElement = messagesContainer.querySelector('.chat-loading');

    if (loadingElement) {
      loadingElement.style.display = 'block';
    }

    const supabase = getSupabaseClient();

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
      .eq('team_id', currentTeam)
      .order('created_at', { ascending: true });

    if (error) throw error;

    chatMessages = data;

    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    renderMessages();

    // Contar mensajes no leídos
    countUnreadMessages();
  } catch (error) {
    console.error('Error al cargar mensajes:', error);

    const messagesContainer = document.getElementById('chatMessages');
    const loadingElement = messagesContainer.querySelector('.chat-loading');

    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    messagesContainer.innerHTML += `
      <div class="alert alert-danger">
        Error al cargar mensajes. Por favor, intenta nuevamente.
      </div>
    `;
  }
}

// Renderizar mensajes
function renderMessages() {
  const messagesContainer = document.getElementById('chatMessages');

  if (!messagesContainer || !chatMessages.length) {
    messagesContainer.innerHTML = '<div class="text-center p-4">No hay mensajes aún. ¡Sé el primero en enviar uno!</div>';
    return;
  }

  messagesContainer.innerHTML = '';

  chatMessages.forEach(message => {
    const isOutgoing = message.user_id === currentUser.id;
    const username = message.users ? message.users.username : 'Usuario desconocido';
    const messageDate = new Date(message.created_at);
    const formattedTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedDate = messageDate.toLocaleDateString();

    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    messageElement.dataset.messageId = message.id;

    messageElement.innerHTML = `
      <div class="chat-message-content">
        <div class="chat-message-header">
          <span class="chat-message-username">${isOutgoing ? 'Tú' : username}</span>
          <span class="chat-message-time">${formattedDate} ${formattedTime}</span>
        </div>
        <div class="chat-message-text">${formatMessageText(message.message)}</div>
        <div class="chat-reactions" data-message-id="${message.id}"></div>
      </div>
    `;

    // Añadir evento para mostrar menú de reacciones
    messageElement.addEventListener('dblclick', (e) => {
      showReactionMenu(e, message.id);
    });

    messagesContainer.appendChild(messageElement);

    // Cargar reacciones para este mensaje
    loadMessageReactions(message.id);

    // Si tiene archivos adjuntos, cargarlos
    if (message.has_attachment) {
      loadMessageAttachments(message.id, messageElement);
    }
  });

  // Desplazar al último mensaje
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Formatear texto del mensaje (procesar menciones, enlaces, etc.)
function formatMessageText(text) {
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
}

// Configurar eventos de la interfaz
function setupUIEvents() {
  // Formulario de envío de mensajes
  const chatForm = document.getElementById('chatInputForm');
  if (chatForm) {
    chatForm.addEventListener('submit', handleMessageSubmit);
  }

  // Botón para adjuntar archivos
  const attachButton = document.getElementById('chatAttachBtn');
  const fileInput = document.getElementById('chatFileInput');

  if (attachButton && fileInput) {
    attachButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', handleFileAttachment);
  }

  // Botón para compartir transacción
  const shareTransactionBtn = document.getElementById('chatShareTransactionBtn');
  if (shareTransactionBtn) {
    shareTransactionBtn.addEventListener('click', () => {
      prepareShareTransaction();
    });
  }

  // Botón para compartir reporte
  const shareReportBtn = document.getElementById('chatShareReportBtn');
  if (shareReportBtn) {
    shareReportBtn.addEventListener('click', () => {
      prepareShareReport();
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

  // Búsqueda de usuarios
  const userSearchInput = document.getElementById('chatUserSearch');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', handleUserSearch);
  }

  // Auto-expandir textarea
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = (chatInput.scrollHeight) + 'px';
    });
  }
}

// Manejar envío de mensajes
async function handleMessageSubmit(event) {
  event.preventDefault();

  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();

  if (!message) return;

  try {
    // Detectar menciones en el mensaje
    const mentionedUsers = detectMentions(message);

    // Enviar mensaje
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('team_messages')
      .insert([
        {
          team_id: currentTeam,
          user_id: currentUser.id,
          message: message,
          has_attachment: false
        }
      ])
      .select();

    if (error) throw error;

    // Si hay menciones, registrarlas
    if (mentionedUsers.length > 0) {
      const messageId = data[0].id;

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
    }

    // Limpiar input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // No es necesario recargar mensajes, la suscripción en tiempo real se encargará
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    alert('Error al enviar mensaje. Por favor, intenta nuevamente.');
  }
}

// Detectar menciones en el mensaje
function detectMentions(message) {
  const mentionedUserIds = [];

  // Buscar patrones @username en el mensaje
  const mentions = message.match(/@(\w+)/g);

  if (!mentions) return mentionedUserIds;

  // Convertir nombres de usuario a IDs
  mentions.forEach(mention => {
    const username = mention.substring(1); // Quitar el @

    const user = teamUsers.find(u =>
      u.username.toLowerCase() === username.toLowerCase()
    );

    if (user && !mentionedUserIds.includes(user.id)) {
      mentionedUserIds.push(user.id);
    }
  });

  return mentionedUserIds;
}

// Configurar suscripciones en tiempo real
function setupRealTimeSubscriptions() {
  if (!currentTeam) return;

  const supabase = getSupabaseClient();

  // Suscripción a nuevos mensajes
  const messagesSubscription = supabase
    .channel('team_messages_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'team_messages',
        filter: `team_id=eq.${currentTeam}`
      },
      payload => {
        handleNewMessage(payload.new);
      }
    )
    .subscribe();

  // Suscripción a reacciones
  const reactionsSubscription = supabase
    .channel('message_reactions_channel')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'message_reactions',
        filter: `message_id=in.(${getMessageIdsFilter()})`
      },
      payload => {
        handleReactionChange(payload);
      }
    )
    .subscribe();

  // Guardar referencias para limpiar al desmontar
  window.chatSubscriptions = {
    messages: messagesSubscription,
    reactions: reactionsSubscription
  };
}

// Obtener filtro de IDs de mensajes para suscripciones
function getMessageIdsFilter() {
  if (!chatMessages.length) return '00000000-0000-0000-0000-000000000000';

  return chatMessages
    .map(msg => msg.id)
    .join(',');
}

// Manejar nuevo mensaje recibido
async function handleNewMessage(message) {
  try {
    // Obtener información del usuario que envió el mensaje
    const supabase = getSupabaseClient();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', message.user_id)
      .single();

    if (userError) throw userError;

    // Añadir el mensaje a la lista
    const enrichedMessage = {
      ...message,
      users: userData
    };

    chatMessages.push(enrichedMessage);

    // Renderizar el nuevo mensaje
    const messagesContainer = document.getElementById('chatMessages');

    const isOutgoing = message.user_id === currentUser.id;
    const username = userData ? userData.username : 'Usuario desconocido';
    const messageDate = new Date(message.created_at);
    const formattedTime = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedDate = messageDate.toLocaleDateString();

    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    messageElement.dataset.messageId = message.id;

    messageElement.innerHTML = `
      <div class="chat-message-content">
        <div class="chat-message-header">
          <span class="chat-message-username">${isOutgoing ? 'Tú' : username}</span>
          <span class="chat-message-time">${formattedDate} ${formattedTime}</span>
        </div>
        <div class="chat-message-text">${formatMessageText(message.message)}</div>
        <div class="chat-reactions" data-message-id="${message.id}"></div>
      </div>
    `;

    // Añadir evento para mostrar menú de reacciones
    messageElement.addEventListener('dblclick', (e) => {
      showReactionMenu(e, message.id);
    });

    messagesContainer.appendChild(messageElement);

    // Desplazar al último mensaje
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Si el mensaje no es del usuario actual, marcarlo como no leído
    if (!isOutgoing) {
      incrementUnreadCount();

      // Si la página de chat está activa, marcar como leído
      if (document.getElementById('teamchat').classList.contains('hidden') === false) {
        markMessageAsRead(message.id);
      }
    }

    // Si tiene archivos adjuntos, cargarlos
    if (message.has_attachment) {
      loadMessageAttachments(message.id, messageElement);
    }
  } catch (error) {
    console.error('Error al procesar nuevo mensaje:', error);
  }
}

// Incrementar contador de mensajes no leídos
function incrementUnreadCount() {
  unreadMessages++;
  updateUnreadBadge();
}

// Actualizar badge de mensajes no leídos
function updateUnreadBadge() {
  const badge = document.getElementById('chatUnreadBadge');

  if (!badge) return;

  if (unreadMessages > 0) {
    badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// Contar mensajes no leídos
async function countUnreadMessages() {
  try {
    if (!currentTeam || !currentUser) return;

    const supabase = getSupabaseClient();

    // Obtener mensajes no leídos
    const { data, error } = await supabase
      .from('team_messages')
      .select(`
        id,
        message_reads!inner(user_id)
      `)
      .eq('team_id', currentTeam)
      .not('user_id', 'eq', currentUser.id)
      .not('message_reads.user_id', 'eq', currentUser.id);

    if (error) throw error;

    unreadMessages = data.length;
    updateUnreadBadge();
  } catch (error) {
    console.error('Error al contar mensajes no leídos:', error);
  }
}

// Marcar todos los mensajes como leídos
async function markAllMessagesAsRead() {
  try {
    if (!currentTeam || !currentUser) return;

    const supabase = getSupabaseClient();

    // Obtener IDs de mensajes no leídos
    const { data: unreadData, error: unreadError } = await supabase
      .from('team_messages')
      .select('id')
      .eq('team_id', currentTeam)
      .not('user_id', 'eq', currentUser.id);

    if (unreadError) throw unreadError;

    // Marcar cada mensaje como leído
    for (const message of unreadData) {
      await markMessageAsRead(message.id);
    }

    // Actualizar contador
    unreadMessages = 0;
    updateUnreadBadge();
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
  }
}

// Marcar un mensaje como leído
async function markMessageAsRead(messageId) {
  try {
    const supabase = getSupabaseClient();

    // Verificar si ya está marcado como leído
    const { data: existingRead, error: checkError } = await supabase
      .from('message_reads')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (checkError) throw checkError;

    // Si ya está marcado, no hacer nada
    if (existingRead) return;

    // Marcar como leído
    const { error } = await supabase
      .from('message_reads')
      .insert([
        {
          message_id: messageId,
          user_id: currentUser.id
        }
      ]);

    if (error) throw error;
  } catch (error) {
    console.error('Error al marcar mensaje como leído:', error);
  }
}

// Exportar funciones principales
export {
  initializeChat,
  loadMessages,
  handleMessageSubmit
};
