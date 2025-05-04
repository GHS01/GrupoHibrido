// Funciones para manejar la burbuja de WhatsApp

// Función para inicializar la burbuja de WhatsApp
function initializeWhatsappBubble() {
  console.log('Inicializando burbuja de WhatsApp...');

  // Obtener la burbuja de WhatsApp
  const whatsappBubble = document.querySelector('.whatsapp-bubble');

  if (!whatsappBubble) {
    console.error('No se encontró el elemento de la burbuja de WhatsApp');
    return;
  }

  // Verificar si el usuario está autenticado
  const userId = sessionStorage.getItem('userId');

  // Mostrar la burbuja solo si el usuario está autenticado
  if (userId) {
    console.log('Usuario autenticado, mostrando burbuja de WhatsApp');
    whatsappBubble.style.display = 'flex';

    // Hacer la burbuja arrastrable
    makeWhatsappBubbleDraggable(whatsappBubble);
  } else {
    console.log('Usuario no autenticado, ocultando burbuja de WhatsApp');
    whatsappBubble.style.display = 'none';
  }
}

// Función para hacer la burbuja de WhatsApp arrastrable
function makeWhatsappBubbleDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let isDragging = false;
  let dragThreshold = 5; // Umbral en píxeles para considerar un movimiento como arrastre
  let startX = 0, startY = 0;

  // Guardar el evento click original
  const originalClickHandler = element.onclick;

  // Eventos para ratón
  element.onmousedown = dragMouseDown;

  // Eventos para pantallas táctiles
  element.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();

    // Marcar que estamos comenzando a arrastrar
    isDragging = false;

    // Guardar la posición inicial
    startX = e.clientX;
    startY = e.clientY;

    // Obtener la posición del cursor al inicio
    pos3 = e.clientX;
    pos4 = e.clientY;

    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function dragTouchStart(e) {
    // Prevenir el comportamiento por defecto (scroll, zoom)
    e.preventDefault();

    if (e.touches.length === 1) {
      // Marcar que estamos comenzando a arrastrar
      isDragging = false;

      // Guardar la posición inicial
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;

      // Obtener la posición del toque al inicio
      pos3 = e.touches[0].clientX;
      pos4 = e.touches[0].clientY;

      document.addEventListener('touchend', closeTouchDragElement, { passive: false });
      document.addEventListener('touchcancel', closeTouchDragElement, { passive: false });
      document.addEventListener('touchmove', elementTouchDrag, { passive: false });
    }
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();

    // Calcular la distancia desde el inicio
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);

    // Si el movimiento supera el umbral, considerar como arrastre
    if (dx > dragThreshold || dy > dragThreshold) {
      isDragging = true;
      // Actualizar la variable global para que el evento de clic sepa que estamos arrastrando
      window.isDraggingWhatsapp = true;
    }

    // Calcular la nueva posición
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    // Calcular la nueva posición
    let newTop = element.offsetTop - pos2;
    let newLeft = element.offsetLeft - pos1;

    // Obtener dimensiones de la ventana y del elemento
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const elementWidth = element.offsetWidth;
    const elementHeight = element.offsetHeight;

    // Asegurar que la burbuja no se salga de los límites de la pantalla
    // Dejar un margen de 10px desde los bordes
    const margin = 10;

    // Limitar posición horizontal
    if (newLeft < margin) {
      newLeft = margin;
    } else if (newLeft + elementWidth > windowWidth - margin) {
      newLeft = windowWidth - elementWidth - margin;
    }

    // Limitar posición vertical
    if (newTop < margin) {
      newTop = margin;
    } else if (newTop + elementHeight > windowHeight - margin) {
      newTop = windowHeight - elementHeight - margin;
    }

    // Establecer la nueva posición del elemento
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
    element.style.bottom = "auto";
    element.style.right = "auto";
  }

  function elementTouchDrag(e) {
    if (e.touches.length === 1) {
      e.preventDefault();

      // Calcular la distancia desde el inicio
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);

      // Si el movimiento supera el umbral, considerar como arrastre
      if (dx > dragThreshold || dy > dragThreshold) {
        isDragging = true;
        // Actualizar la variable global para que el evento de clic sepa que estamos arrastrando
        window.isDraggingWhatsapp = true;
      }

      // Calcular la nueva posición
      pos1 = pos3 - e.touches[0].clientX;
      pos2 = pos4 - e.touches[0].clientY;
      pos3 = e.touches[0].clientX;
      pos4 = e.touches[0].clientY;

      // Calcular la nueva posición
      let newTop = element.offsetTop - pos2;
      let newLeft = element.offsetLeft - pos1;

      // Obtener dimensiones de la ventana y del elemento
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const elementWidth = element.offsetWidth;
      const elementHeight = element.offsetHeight;

      // Asegurar que la burbuja no se salga de los límites de la pantalla
      // Dejar un margen de 10px desde los bordes
      const margin = 10;

      // Limitar posición horizontal
      if (newLeft < margin) {
        newLeft = margin;
      } else if (newLeft + elementWidth > windowWidth - margin) {
        newLeft = windowWidth - elementWidth - margin;
      }

      // Limitar posición vertical
      if (newTop < margin) {
        newTop = margin;
      } else if (newTop + elementHeight > windowHeight - margin) {
        newTop = windowHeight - elementHeight - margin;
      }

      // Establecer la nueva posición del elemento
      element.style.top = newTop + "px";
      element.style.left = newLeft + "px";
      element.style.bottom = "auto";
      element.style.right = "auto";
    }
  }

  function closeDragElement(e) {
    // Detener el movimiento cuando se suelta el botón del mouse
    document.onmouseup = null;
    document.onmousemove = null;

    // Guardar la posición en localStorage para mantenerla entre recargas
    localStorage.setItem('whatsappBubbleTop', element.style.top);
    localStorage.setItem('whatsappBubbleLeft', element.style.left);

    // Si estábamos arrastrando, prevenir la acción de clic
    if (isDragging) {
      e.stopPropagation();

      // Temporalmente eliminar el evento de clic
      const currentClickHandler = element.onclick;
      element.onclick = null;

      // Restaurar el evento de clic después de un breve retraso
      setTimeout(function() {
        element.onclick = currentClickHandler;
        // Restablecer la variable global después de un breve retraso
        window.isDraggingWhatsapp = false;
      }, 300); // Aumentamos el tiempo para asegurarnos de que no se active el clic

      return false;
    } else {
      // Si no estábamos arrastrando, asegurarnos de que la variable global esté en false
      window.isDraggingWhatsapp = false;
    }
  }

  function closeTouchDragElement(e) {
    // Detener el movimiento cuando se termina el toque
    document.removeEventListener('touchend', closeTouchDragElement);
    document.removeEventListener('touchcancel', closeTouchDragElement);
    document.removeEventListener('touchmove', elementTouchDrag);

    // Guardar la posición en localStorage para mantenerla entre recargas
    localStorage.setItem('whatsappBubbleTop', element.style.top);
    localStorage.setItem('whatsappBubbleLeft', element.style.left);

    // Si estábamos arrastrando, prevenir la acción de clic
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();

      // Temporalmente eliminar el evento de clic
      const currentTouchHandler = element.ontouchend;
      element.ontouchend = null;

      // Restaurar el evento de clic después de un breve retraso
      setTimeout(function() {
        element.ontouchend = currentTouchHandler;
        // Restablecer la variable global después de un breve retraso
        window.isDraggingWhatsapp = false;
      }, 300); // Aumentamos el tiempo para asegurarnos de que no se active el clic

      return false;
    } else {
      // Si no estábamos arrastrando, asegurarnos de que la variable global esté en false
      window.isDraggingWhatsapp = false;
    }
  }

  // Restaurar la posición guardada si existe
  const savedTop = localStorage.getItem('whatsappBubbleTop');
  const savedLeft = localStorage.getItem('whatsappBubbleLeft');

  // Obtener dimensiones de la ventana y del elemento
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const elementWidth = element.offsetWidth;
  const elementHeight = element.offsetHeight;

  // Posición predeterminada para dispositivos móviles (abajo a la derecha)
  let defaultTop = windowHeight - elementHeight - 20;
  let defaultLeft = windowWidth - elementWidth - 20;

  if (savedTop && savedLeft) {
    // Convertir valores guardados a números para poder validarlos
    let topValue = parseInt(savedTop);
    let leftValue = parseInt(savedLeft);

    // Verificar si la posición guardada está dentro de los límites visibles
    if (isNaN(topValue) || isNaN(leftValue) ||
        topValue < 0 || topValue > windowHeight - elementHeight ||
        leftValue < 0 || leftValue > windowWidth - elementWidth) {
      // Si está fuera de los límites, usar la posición predeterminada
      element.style.top = defaultTop + "px";
      element.style.left = defaultLeft + "px";
    } else {
      // Si está dentro de los límites, usar la posición guardada
      element.style.top = savedTop;
      element.style.left = savedLeft;
    }
  } else {
    // Si no hay posición guardada, usar la posición predeterminada
    element.style.top = defaultTop + "px";
    element.style.left = defaultLeft + "px";
  }

  element.style.bottom = "auto";
  element.style.right = "auto";

  // Asegurar que la burbuja sea visible al cambiar el tamaño de la ventana
  window.addEventListener('resize', function() {
    // Obtener nuevas dimensiones
    const newWindowWidth = window.innerWidth;
    const newWindowHeight = window.innerHeight;

    // Obtener posición actual
    let currentTop = parseInt(element.style.top);
    let currentLeft = parseInt(element.style.left);

    // Verificar si la posición actual está dentro de los límites visibles
    if (isNaN(currentTop) || isNaN(currentLeft) ||
        currentTop < 0 || currentTop > newWindowHeight - elementHeight ||
        currentLeft < 0 || currentLeft > newWindowWidth - elementWidth) {
      // Si está fuera de los límites, ajustar la posición
      if (currentTop < 0) currentTop = 10;
      if (currentLeft < 0) currentLeft = 10;
      if (currentTop > newWindowHeight - elementHeight) currentTop = newWindowHeight - elementHeight - 10;
      if (currentLeft > newWindowWidth - elementWidth) currentLeft = newWindowWidth - elementWidth - 10;

      // Aplicar la nueva posición
      element.style.top = currentTop + "px";
      element.style.left = currentLeft + "px";

      // Guardar la nueva posición
      localStorage.setItem('whatsappBubbleTop', element.style.top);
      localStorage.setItem('whatsappBubbleLeft', element.style.left);
    }
  });
}

// Función para mostrar la burbuja de WhatsApp
function showWhatsappBubble() {
  const whatsappBubble = document.querySelector('.whatsapp-bubble');
  if (whatsappBubble) {
    whatsappBubble.style.display = 'flex';
  }
}

// Función para ocultar la burbuja de WhatsApp
function hideWhatsappBubble() {
  const whatsappBubble = document.querySelector('.whatsapp-bubble');
  if (whatsappBubble) {
    whatsappBubble.style.display = 'none';
  }
}

// Función para verificar y ajustar la posición de la burbuja
function checkAndAdjustBubblePosition() {
  const whatsappBubble = document.querySelector('.whatsapp-bubble');
  if (!whatsappBubble) return;

  // Obtener dimensiones de la ventana y del elemento
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const elementWidth = whatsappBubble.offsetWidth;
  const elementHeight = whatsappBubble.offsetHeight;

  // Obtener posición actual
  let currentTop = parseInt(whatsappBubble.style.top);
  let currentLeft = parseInt(whatsappBubble.style.left);

  // Si no hay posición definida o está fuera de los límites, ajustar a una posición predeterminada
  if (isNaN(currentTop) || isNaN(currentLeft) ||
      currentTop < 0 || currentTop > windowHeight - elementHeight ||
      currentLeft < 0 || currentLeft > windowWidth - elementWidth) {

    // Posición predeterminada (abajo a la derecha)
    let defaultTop = windowHeight - elementHeight - 20;
    let defaultLeft = windowWidth - elementWidth - 20;

    // Aplicar la nueva posición
    whatsappBubble.style.top = defaultTop + "px";
    whatsappBubble.style.left = defaultLeft + "px";
    whatsappBubble.style.bottom = "auto";
    whatsappBubble.style.right = "auto";

    // Guardar la nueva posición
    localStorage.setItem('whatsappBubbleTop', whatsappBubble.style.top);
    localStorage.setItem('whatsappBubbleLeft', whatsappBubble.style.left);
  }
}

// Inicializar la burbuja cuando se carga el documento
document.addEventListener('DOMContentLoaded', function() {
  console.log('Configurando eventos para la burbuja de WhatsApp...');

  // Inicializar la burbuja
  initializeWhatsappBubble();

  // Verificar y ajustar la posición de la burbuja después de un breve retraso
  setTimeout(function() {
    checkAndAdjustBubblePosition();
  }, 500);

  // Verificar periódicamente si el usuario está autenticado
  setInterval(function() {
    const userId = sessionStorage.getItem('userId');
    const whatsappBubble = document.querySelector('.whatsapp-bubble');

    if (whatsappBubble) {
      if (userId) {
        // Si el usuario está autenticado y la burbuja está oculta, mostrarla
        if (whatsappBubble.style.display === 'none') {
          whatsappBubble.style.display = 'block';
          // Verificar y ajustar la posición cuando se muestra la burbuja
          setTimeout(checkAndAdjustBubblePosition, 100);
        }
      } else {
        // Si el usuario no está autenticado, ocultar la burbuja
        whatsappBubble.style.display = 'none';
      }
    }
  }, 5000); // Verificar cada 5 segundos

  // Ajustar la posición de la burbuja cuando se cambia el tamaño de la ventana
  window.addEventListener('resize', function() {
    checkAndAdjustBubblePosition();
  });
});

// Exponer funciones globalmente
window.whatsappBubble = {
  initialize: initializeWhatsappBubble,
  show: showWhatsappBubble,
  hide: hideWhatsappBubble,
  checkPosition: checkAndAdjustBubblePosition
};
