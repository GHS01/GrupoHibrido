// Sistema de notificaciones para la aplicación

// Función para mostrar notificaciones al usuario
function showNotification(title, message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
  
  // Verificar si ya existe un contenedor de notificaciones
  let notificationContainer = document.getElementById('notification-container');
  
  // Si no existe, crearlo
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '9999';
    document.body.appendChild(notificationContainer);
  }
  
  // Crear la notificación
  const notification = document.createElement('div');
  notification.className = `custom-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
    <div class="notification-progress"></div>
  `;
  
  // Agregar la notificación al contenedor
  notificationContainer.appendChild(notification);
  
  // Mostrar la notificación con una animación
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Configurar la barra de progreso
  const progress = notification.querySelector('.notification-progress');
  progress.style.width = '100%';
  progress.style.height = '3px';
  progress.style.backgroundColor = type === 'error' ? '#dc3545' : 
                                  type === 'success' ? '#28a745' : 
                                  type === 'warning' ? '#ffc107' : '#17a2b8';
  progress.style.position = 'absolute';
  progress.style.bottom = '0';
  progress.style.left = '0';
  progress.style.transition = 'width 5s linear';
  
  // Iniciar la animación de la barra de progreso
  setTimeout(() => {
    progress.style.width = '0';
  }, 100);
  
  // Ocultar la notificación después de 5 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
  
  // Si no hay soporte para notificaciones personalizadas, usar alert como fallback
  if (!document.querySelector('.custom-notification')) {
    if (type === 'error') {
      alert(`Error: ${message}`);
    } else if (message.length > 0) {
      alert(`${title}: ${message}`);
    }
  }
}

// Función para mostrar un diálogo de confirmación
function showConfirmDialog(options) {
  return new Promise((resolve) => {
    const { title, message, confirmText, cancelText, isDanger } = {
      title: 'Confirmar',
      message: '¿Está seguro de realizar esta acción?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      isDanger: false,
      ...options
    };
    
    // Crear el overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    
    // Crear el modal
    const modal = document.createElement('div');
    modal.className = 'custom-modal';
    modal.style.backgroundColor = '#ffffff';
    modal.style.borderRadius = '12px';
    modal.style.padding = '25px';
    modal.style.width = '90%';
    modal.style.maxWidth = '500px';
    modal.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    
    // Contenido del modal
    modal.innerHTML = `
      <div class="custom-modal-header">
        <h3 class="custom-modal-title">${title}</h3>
      </div>
      <div class="custom-modal-content">${message}</div>
      <div class="custom-modal-actions">
        <button class="custom-modal-btn custom-modal-btn-cancel">${cancelText}</button>
        <button class="custom-modal-btn ${isDanger ? 'custom-modal-btn-danger' : 'custom-modal-btn-confirm'}">${confirmText}</button>
      </div>
    `;
    
    // Agregar el modal al overlay
    overlay.appendChild(modal);
    
    // Agregar el overlay al body
    document.body.appendChild(overlay);
    
    // Mostrar el modal con una animación
    setTimeout(() => {
      overlay.classList.add('show');
      modal.classList.add('show');
    }, 10);
    
    // Manejar los botones
    const cancelButton = modal.querySelector('.custom-modal-btn-cancel');
    const confirmButton = modal.querySelector('.custom-modal-btn-confirm, .custom-modal-btn-danger');
    
    // Función para cerrar el modal
    const closeModal = (result) => {
      overlay.classList.remove('show');
      modal.classList.remove('show');
      
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 300);
    };
    
    // Eventos de los botones
    cancelButton.addEventListener('click', () => closeModal(false));
    confirmButton.addEventListener('click', () => closeModal(true));
    
    // Si no hay soporte para modales personalizados, usar confirm como fallback
    if (!document.querySelector('.custom-modal-overlay')) {
      const result = confirm(message);
      resolve(result);
    }
  });
}

// Exponer las funciones globalmente
window.showNotification = showNotification;
window.showConfirmDialog = showConfirmDialog;
