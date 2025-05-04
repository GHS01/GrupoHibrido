// Funcionalidades de UI para el chat de equipo
import { getSupabaseClient } from './supabaseConfig.js';
import { initializeChat } from './teamChat.js';

// Funciones para manejar reacciones
async function loadMessageReactions(messageId) {
  try {
    const supabase = getSupabaseClient();
    
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
        toggleReaction(messageId, group.reaction);
      });
      
      reactionsContainer.appendChild(reactionElement);
    });
  } catch (error) {
    console.error('Error al cargar reacciones:', error);
  }
}

// Mostrar menú de reacciones
function showReactionMenu(event, messageId) {
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
      toggleReaction(messageId, reaction);
      reactionMenu.style.display = 'none';
    });
  });
  
  // Cerrar menú al hacer clic fuera
  document.addEventListener('click', closeReactionMenu);
}

// Cerrar menú de reacciones
function closeReactionMenu(event) {
  const reactionMenu = document.getElementById('reactionMenu');
  
  if (!reactionMenu) return;
  
  // Si el clic no fue dentro del menú, cerrarlo
  if (!reactionMenu.contains(event.target)) {
    reactionMenu.style.display = 'none';
    document.removeEventListener('click', closeReactionMenu);
  }
}

// Alternar reacción (añadir/quitar)
async function toggleReaction(messageId, reaction) {
  try {
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    
    if (!currentUser) {
      console.error('No hay un usuario autenticado');
      return;
    }
    
    const supabase = getSupabaseClient();
    
    // Verificar si ya existe la reacción
    const { data: existingReaction, error: checkError } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', currentUser.id)
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
            user_id: currentUser.id,
            reaction: reaction
          }
        ]);
      
      if (error) throw error;
    }
    
    // No es necesario recargar, la suscripción en tiempo real se encargará
  } catch (error) {
    console.error('Error al alternar reacción:', error);
  }
}

// Manejar cambio en reacciones (tiempo real)
function handleReactionChange(payload) {
  const messageId = payload.new ? payload.new.message_id : payload.old.message_id;
  
  // Recargar reacciones para este mensaje
  loadMessageReactions(messageId);
}

// Cargar archivos adjuntos de un mensaje
async function loadMessageAttachments(messageId, messageElement) {
  try {
    const supabase = getSupabaseClient();
    
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
      const fileSize = formatFileSize(file.file_size);
      
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
        downloadFile(file.file_path, file.file_name);
      });
      
      attachmentsContainer.appendChild(attachmentElement);
    });
    
    // Añadir contenedor al mensaje
    const messageContent = messageElement.querySelector('.chat-message-content');
    messageContent.appendChild(attachmentsContainer);
  } catch (error) {
    console.error('Error al cargar archivos adjuntos:', error);
  }
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Descargar archivo
async function downloadFile(filePath, fileName) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .storage
      .from('team_files')
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
}

// Manejar adjuntar archivo
async function handleFileAttachment(event) {
  const file = event.target.files[0];
  
  if (!file) return;
  
  try {
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    const currentTeam = currentUser.teamId;
    
    if (!currentUser || !currentTeam) {
      console.error('No hay un usuario autenticado o no pertenece a un equipo');
      return;
    }
    
    // Mostrar indicador de carga
    const chatInput = document.getElementById('chatInput');
    const originalPlaceholder = chatInput.placeholder;
    chatInput.placeholder = 'Subiendo archivo...';
    chatInput.disabled = true;
    
    const supabase = getSupabaseClient();
    
    // 1. Subir el archivo
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `team_files/${currentTeam}/${fileName}`;
    
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('team_files')
      .upload(filePath, file);
    
    if (fileError) throw fileError;
    
    // 2. Crear mensaje con referencia al archivo
    const message = chatInput.value.trim() || `Archivo compartido: ${file.name}`;
    
    const { data: messageData, error: messageError } = await supabase
      .from('team_messages')
      .insert([
        {
          team_id: currentTeam,
          user_id: currentUser.id,
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
}

// Preparar compartir transacción
async function prepareShareTransaction() {
  try {
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    
    if (!currentUser) {
      console.error('No hay un usuario autenticado');
      return;
    }
    
    const supabase = getSupabaseClient();
    
    // Obtener transacciones del usuario
    const { data, error } = await supabase
      .from('transactions')
      .select('id, date, description, amount, type, category')
      .eq('user_id', currentUser.id)
      .order('date', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    // Llenar select con transacciones
    const select = document.getElementById('shareTransactionSelect');
    
    if (!select) return;
    
    // Limpiar opciones anteriores
    select.innerHTML = '<option value="">Selecciona una transacción...</option>';
    
    // Añadir transacciones
    data.forEach(transaction => {
      const option = document.createElement('option');
      option.value = transaction.id;
      
      const type = transaction.type === 'entrada' || transaction.type === 'Ingreso' ? 'Ingreso' : 'Gasto';
      const amount = Math.abs(parseFloat(transaction.amount)).toFixed(2);
      
      option.textContent = `${transaction.date} - ${type} - ${transaction.category} - S/. ${amount} - ${transaction.description}`;
      
      select.appendChild(option);
    });
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('shareTransactionModal'));
    modal.show();
    
    // Configurar botón de confirmación
    const confirmButton = document.getElementById('confirmShareTransaction');
    
    // Eliminar eventos anteriores
    confirmButton.replaceWith(confirmButton.cloneNode(true));
    
    // Añadir nuevo evento
    const newConfirmButton = document.getElementById('confirmShareTransaction');
    
    newConfirmButton.addEventListener('click', async () => {
      const transactionId = select.value;
      const message = document.getElementById('shareTransactionMessage').value.trim();
      
      if (!transactionId) {
        alert('Por favor, selecciona una transacción');
        return;
      }
      
      await shareTransaction(transactionId, message);
      modal.hide();
    });
  } catch (error) {
    console.error('Error al preparar compartir transacción:', error);
    alert('Error al cargar transacciones. Por favor, intenta nuevamente.');
  }
}

// Compartir transacción
async function shareTransaction(transactionId, message) {
  try {
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    const currentTeam = currentUser.teamId;
    
    if (!currentUser || !currentTeam) {
      console.error('No hay un usuario autenticado o no pertenece a un equipo');
      return;
    }
    
    const supabase = getSupabaseClient();
    
    // 1. Obtener datos de la transacción
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (transactionError) throw transactionError;
    
    // 2. Crear mensaje con la transacción
    const transactionJson = JSON.stringify(transactionData);
    const fullMessage = `${message || 'Compartiendo una transacción:'}\n\n[TRANSACTION]${transactionJson}[/TRANSACTION]`;
    
    // 3. Enviar mensaje
    const { error: messageError } = await supabase
      .from('team_messages')
      .insert([
        {
          team_id: currentTeam,
          user_id: currentUser.id,
          message: fullMessage,
          has_attachment: false
        }
      ]);
    
    if (messageError) throw messageError;
    
    // No es necesario recargar, la suscripción en tiempo real se encargará
  } catch (error) {
    console.error('Error al compartir transacción:', error);
    alert('Error al compartir la transacción. Por favor, intenta nuevamente.');
  }
}

// Preparar compartir reporte
function prepareShareReport() {
  try {
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('shareReportModal'));
    modal.show();
    
    // Configurar botón de confirmación
    const confirmButton = document.getElementById('confirmShareReport');
    
    // Eliminar eventos anteriores
    confirmButton.replaceWith(confirmButton.cloneNode(true));
    
    // Añadir nuevo evento
    const newConfirmButton = document.getElementById('confirmShareReport');
    
    newConfirmButton.addEventListener('click', async () => {
      const reportType = document.getElementById('shareReportType').value;
      const message = document.getElementById('shareReportMessage').value.trim();
      
      if (!reportType) {
        alert('Por favor, selecciona un tipo de reporte');
        return;
      }
      
      await shareReport(reportType, message);
      modal.hide();
    });
  } catch (error) {
    console.error('Error al preparar compartir reporte:', error);
    alert('Error al preparar el reporte. Por favor, intenta nuevamente.');
  }
}

// Compartir reporte
async function shareReport(reportType, message) {
  try {
    const currentUser = JSON.parse(sessionStorage.getItem('user'));
    const currentTeam = currentUser.teamId;
    
    if (!currentUser || !currentTeam) {
      console.error('No hay un usuario autenticado o no pertenece a un equipo');
      return;
    }
    
    // Obtener datos del reporte
    let reportData;
    let reportTitle;
    
    switch (reportType) {
      case 'balanco':
        reportData = window.balanceSheetData || {};
        reportTitle = 'Balance General';
        break;
      case 'dre':
        reportData = window.incomeStatementData || {};
        reportTitle = 'Estado de Resultados';
        break;
      case 'fluxoCaixa':
        reportData = window.cashFlowData || {};
        reportTitle = 'Flujo de Caja';
        break;
      default:
        throw new Error('Tipo de reporte no válido');
    }
    
    const supabase = getSupabaseClient();
    
    // Crear mensaje con el reporte
    const reportJson = JSON.stringify({
      type: reportType,
      title: reportTitle,
      data: reportData
    });
    
    const fullMessage = `${message || `Compartiendo reporte: ${reportTitle}`}\n\n[REPORT]${reportJson}[/REPORT]`;
    
    // Enviar mensaje
    const { error: messageError } = await supabase
      .from('team_messages')
      .insert([
        {
          team_id: currentTeam,
          user_id: currentUser.id,
          message: fullMessage,
          has_attachment: false
        }
      ]);
    
    if (messageError) throw messageError;
    
    // No es necesario recargar, la suscripción en tiempo real se encargará
  } catch (error) {
    console.error('Error al compartir reporte:', error);
    alert('Error al compartir el reporte. Por favor, intenta nuevamente.');
  }
}

// Manejar búsqueda de usuarios
function handleUserSearch(event) {
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
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  // Verificar si el usuario está autenticado
  const userId = sessionStorage.getItem('userId');
  
  if (userId) {
    // Inicializar chat cuando se muestra la página
    const chatLink = document.querySelector('.nav-link[data-page="teamchat"]');
    
    if (chatLink) {
      chatLink.addEventListener('click', () => {
        // Inicializar chat si no se ha hecho
        if (!window.chatInitialized) {
          initializeChat();
          window.chatInitialized = true;
        }
        
        // Marcar mensajes como leídos
        markAllMessagesAsRead();
      });
    }
  }
});

// Exportar funciones principales
export {
  loadMessageReactions,
  handleReactionChange,
  loadMessageAttachments,
  handleFileAttachment,
  prepareShareTransaction,
  prepareShareReport
};
