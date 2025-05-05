// Funciones adicionales para la UI del chat de equipo

// Cargar reacciones de un mensaje
window.loadChatMessageReactions = async function(messageId) {
  try {
    const supabase = window.getSupabaseClient();

    const { data, error } = await supabase
      .from('message_reactions')
      .select(`
        reaction,
        users:user_id (id, username)
      `)
      .eq('message_id', messageId);

    if (error) throw error;

    // Agrupar reacciones
    const reactionsContainer = document.querySelector(`.chat-reactions[data-message-id="${messageId}"]`);

    if (!reactionsContainer || !data.length) return;

    // Limpiar contenedor
    reactionsContainer.innerHTML = '';

    // Agrupar por tipo de reacción
    const reactionGroups = {};

    data.forEach(item => {
      if (!reactionGroups[item.reaction]) {
        reactionGroups[item.reaction] = {
          reaction: item.reaction,
          count: 0,
          users: []
        };
      }

      reactionGroups[item.reaction].count++;
      reactionGroups[item.reaction].users.push(item.users);
    });

    // Renderizar reacciones
    Object.values(reactionGroups).forEach(group => {
      const reactionElement = document.createElement('div');
      reactionElement.className = 'chat-reaction';
      reactionElement.dataset.reaction = group.reaction;

      // Crear tooltip con nombres de usuarios
      const usernames = group.users.map(user => user.username).join(', ');

      reactionElement.innerHTML = `
        <span class="chat-reaction-emoji">${group.reaction}</span>
        <span class="chat-reaction-count">${group.count}</span>
      `;

      reactionElement.title = usernames;

      // Añadir evento para alternar reacción
      reactionElement.addEventListener('click', () => {
        window.toggleChatReaction(messageId, group.reaction);
      });

      reactionsContainer.appendChild(reactionElement);
    });
  } catch (error) {
    console.error('Error al cargar reacciones:', error);
  }
};

// Mostrar menú de reacciones
window.showChatReactionMenu = function(event, messageId) {
  const reactionMenu = document.getElementById('reactionMenu');

  if (!reactionMenu) return;

  // Posicionar menú
  const x = event.clientX;
  const y = event.clientY;

  reactionMenu.style.left = `${x}px`;
  reactionMenu.style.top = `${y}px`;
  reactionMenu.style.display = 'flex';

  // Guardar ID del mensaje
  reactionMenu.dataset.messageId = messageId;

  // Añadir eventos a los items del menú
  const menuItems = reactionMenu.querySelectorAll('.chat-reaction-menu-item');

  menuItems.forEach(item => {
    const reaction = item.dataset.reaction;

    // Eliminar eventos anteriores
    item.replaceWith(item.cloneNode(true));

    // Añadir nuevo evento
    const newItem = reactionMenu.querySelector(`.chat-reaction-menu-item[data-reaction="${reaction}"]`);

    newItem.addEventListener('click', () => {
      window.toggleChatReaction(messageId, reaction);
      reactionMenu.style.display = 'none';
    });
  });

  // Cerrar menú al hacer clic fuera
  document.addEventListener('click', window.closeChatReactionMenu);
};

// Cerrar menú de reacciones
window.closeChatReactionMenu = function(event) {
  const reactionMenu = document.getElementById('reactionMenu');

  if (!reactionMenu) return;

  // Si el clic no fue dentro del menú, cerrarlo
  if (!reactionMenu.contains(event.target)) {
    reactionMenu.style.display = 'none';
    document.removeEventListener('click', window.closeChatReactionMenu);
  }
};

// Alternar reacción (añadir/quitar)
window.toggleChatReaction = async function(messageId, reaction) {
  try {
    if (!window.teamChat.currentUser) {
      console.error('No hay un usuario autenticado');
      return;
    }

    const supabase = window.getSupabaseClient();

    // Verificar si ya existe la reacción
    const { data: existingReaction, error: checkError } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', window.teamChat.currentUser.id)
      .eq('reaction', reaction)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingReaction) {
      // Eliminar reacción
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (error) throw error;
    } else {
      // Añadir reacción
      const { error } = await supabase
        .from('message_reactions')
        .insert([
          {
            message_id: messageId,
            user_id: window.teamChat.currentUser.id,
            reaction: reaction
          }
        ]);

      if (error) throw error;
    }

    // No es necesario recargar, la suscripción en tiempo real se encargará
  } catch (error) {
    console.error('Error al alternar reacción:', error);
  }
};

// Manejar cambio en reacciones (tiempo real)
window.handleChatReactionChange = function(payload) {
  const messageId = payload.new ? payload.new.message_id : payload.old.message_id;

  // Recargar reacciones para este mensaje
  window.loadChatMessageReactions(messageId);
};

// Cargar archivos adjuntos de un mensaje
window.loadChatMessageAttachments = async function(messageId, messageElement) {
  try {
    const supabase = window.getSupabaseClient();

    const { data, error } = await supabase
      .from('team_files')
      .select('*')
      .eq('message_id', messageId);

    if (error) throw error;

    if (!data.length) return;

    // Crear contenedor para archivos
    const attachmentsContainer = document.createElement('div');
    attachmentsContainer.className = 'chat-attachments';

    data.forEach(file => {
      const attachmentElement = document.createElement('div');
      attachmentElement.className = 'chat-attachment';

      // Determinar icono según tipo de archivo
      let icon = 'file';

      if (file.file_type.startsWith('image/')) {
        icon = 'image';
      } else if (file.file_type.startsWith('video/')) {
        icon = 'video';
      } else if (file.file_type.startsWith('audio/')) {
        icon = 'music';
      } else if (file.file_type.includes('pdf')) {
        icon = 'file-pdf';
      } else if (file.file_type.includes('word') || file.file_type.includes('document')) {
        icon = 'file-word';
      } else if (file.file_type.includes('excel') || file.file_type.includes('sheet')) {
        icon = 'file-excel';
      }

      // Formatear tamaño del archivo
      const fileSize = window.formatChatFileSize(file.file_size);

      attachmentElement.innerHTML = `
        <div class="chat-attachment-icon">
          <i class="fas fa-${icon}"></i>
        </div>
        <div class="chat-attachment-info">
          <div class="chat-attachment-name">${file.file_name}</div>
          <div class="chat-attachment-size">${fileSize}</div>
        </div>
        <div class="chat-attachment-download" data-file-path="${file.file_path}">
          <i class="fas fa-download"></i>
        </div>
      `;

      // Añadir evento para descargar
      const downloadButton = attachmentElement.querySelector('.chat-attachment-download');

      downloadButton.addEventListener('click', () => {
        window.downloadChatFile(file.file_path, file.file_name);
      });

      attachmentsContainer.appendChild(attachmentElement);
    });

    // Añadir contenedor al mensaje
    const messageContent = messageElement.querySelector('.chat-message-content');
    messageContent.appendChild(attachmentsContainer);
  } catch (error) {
    console.error('Error al cargar archivos adjuntos:', error);
  }
};

// Formatear tamaño de archivo
window.formatChatFileSize = function(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Descargar archivo
window.downloadChatFile = async function(filePath, fileName) {
  try {
    const supabase = window.getSupabaseClient();

    const { data, error } = await supabase
      .storage
      .from('chat-attachments')
      .download(filePath);

    if (error) throw error;

    // Crear URL para el archivo
    const url = URL.createObjectURL(data);

    // Crear enlace de descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // Limpiar
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    alert('Error al descargar el archivo. Por favor, intenta nuevamente.');
  }
};

// Manejar adjuntar archivo
window.handleChatFileAttachment = async function(event) {
  const file = event.target.files[0];

  if (!file) return;

  try {
    if (!window.teamChat.currentUser || !window.teamChat.currentTeam) {
      console.error('No hay un usuario autenticado o no pertenece a un equipo');
      return;
    }

    // Mostrar indicador de carga
    const chatInput = document.getElementById('chatInput');
    const originalPlaceholder = chatInput.placeholder;
    chatInput.placeholder = 'Subiendo archivo...';
    chatInput.disabled = true;

    const supabase = window.getSupabaseClient();

    // 1. Subir el archivo
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `team_chat/${window.teamChat.currentTeam}/${fileName}`;

    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('chat-attachments')
      .upload(filePath, file);

    if (fileError) throw fileError;

    // 2. Crear mensaje con referencia al archivo
    const message = chatInput.value.trim() || `Archivo compartido: ${file.name}`;

    const { data: messageData, error: messageError } = await supabase
      .from('team_messages')
      .insert([
        {
          team_id: window.teamChat.currentTeam,
          user_id: window.teamChat.currentUser.id,
          message: message,
          has_attachment: true
        }
      ])
      .select();

    if (messageError) throw messageError;

    // 3. Registrar el archivo
    const { error: fileRecordError } = await supabase
      .from('team_files')
      .insert([
        {
          message_id: messageData[0].id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_path: filePath
        }
      ]);

    if (fileRecordError) throw fileRecordError;

    // Limpiar input
    chatInput.value = '';
    chatInput.placeholder = originalPlaceholder;
    chatInput.disabled = false;
    event.target.value = '';

    // No es necesario recargar, la suscripción en tiempo real se encargará
  } catch (error) {
    console.error('Error al adjuntar archivo:', error);
    alert('Error al subir el archivo. Por favor, intenta nuevamente.');

    // Restaurar input
    const chatInput = document.getElementById('chatInput');
    chatInput.placeholder = 'Escribe un mensaje...';
    chatInput.disabled = false;
  }
};





// Manejar búsqueda de usuarios
window.handleChatUserSearch = function(event) {
  const searchTerm = event.target.value.toLowerCase();
  const userItems = document.querySelectorAll('.chat-user-item');

  userItems.forEach(item => {
    const username = item.querySelector('.chat-user-name').textContent.toLowerCase();

    if (username.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
};
