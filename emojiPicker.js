// Funcionalidades para el selector de emojis en el chat de equipo

// Inicializar el selector de emojis
window.initEmojiPicker = function() {
  try {
    console.log('Inicializando selector de emojis...');
    
    // Obtener elementos
    const emojiButton = document.getElementById('chatEmojiBtn');
    const emojiPickerContainer = document.getElementById('emojiPickerContainer');
    const emojiPicker = document.querySelector('emoji-picker');
    const chatInput = document.getElementById('chatInput');
    
    if (!emojiButton || !emojiPickerContainer || !emojiPicker || !chatInput) {
      console.error('No se encontraron todos los elementos necesarios para el selector de emojis');
      return;
    }
    
    // Configurar evento para mostrar/ocultar el selector
    emojiButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Alternar visibilidad
      if (emojiPickerContainer.style.display === 'none') {
        emojiPickerContainer.style.display = 'block';
      } else {
        emojiPickerContainer.style.display = 'none';
      }
    });
    
    // Configurar evento para seleccionar un emoji
    emojiPicker.addEventListener('emoji-click', function(event) {
      // Obtener el emoji seleccionado
      const emoji = event.detail.unicode;
      
      // Insertar el emoji en la posición actual del cursor
      insertEmojiAtCursor(chatInput, emoji);
      
      // Ocultar el selector después de seleccionar
      emojiPickerContainer.style.display = 'none';
    });
    
    // Cerrar el selector al hacer clic fuera
    document.addEventListener('click', function(e) {
      if (emojiPickerContainer.style.display === 'block' && 
          !emojiPickerContainer.contains(e.target) && 
          e.target !== emojiButton) {
        emojiPickerContainer.style.display = 'none';
      }
    });
    
    console.log('Selector de emojis inicializado correctamente');
  } catch (error) {
    console.error('Error al inicializar el selector de emojis:', error);
  }
};

// Función para insertar un emoji en la posición actual del cursor
function insertEmojiAtCursor(inputElement, emoji) {
  if (!inputElement) return;
  
  // Guardar posiciones de selección
  const startPos = inputElement.selectionStart;
  const endPos = inputElement.selectionEnd;
  
  // Obtener texto actual
  const text = inputElement.value;
  
  // Insertar emoji en la posición del cursor
  const newText = text.substring(0, startPos) + emoji + text.substring(endPos);
  
  // Actualizar el valor del input
  inputElement.value = newText;
  
  // Mover el cursor después del emoji insertado
  const newCursorPos = startPos + emoji.length;
  inputElement.setSelectionRange(newCursorPos, newCursorPos);
  
  // Enfocar el input
  inputElement.focus();
}

// Personalizar el selector de emojis
window.customizeEmojiPicker = function() {
  try {
    const emojiPicker = document.querySelector('emoji-picker');
    
    if (!emojiPicker) return;
    
    // Configurar opciones del selector
    emojiPicker.setAttribute('class', 'modern-emoji-picker');
    
    // Aplicar estilos personalizados
    const style = document.createElement('style');
    style.textContent = `
      .modern-emoji-picker {
        --background: #ffffff;
        --border-color: #e0e0e0;
        --indicator-color: #007bff;
        --input-border-color: #e0e0e0;
        --input-font-color: #333333;
        --input-placeholder-color: #999999;
        --outline-color: #007bff;
        border-radius: 12px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        border: 1px solid #e0e0e0;
        max-width: 320px;
        max-height: 350px;
      }
      
      #emojiPickerContainer {
        transition: all 0.3s ease;
      }
    `;
    
    document.head.appendChild(style);
  } catch (error) {
    console.error('Error al personalizar el selector de emojis:', error);
  }
};

// Inicializar cuando se carga el documento
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar después de un breve retraso para asegurar que todos los elementos estén cargados
  setTimeout(() => {
    window.initEmojiPicker();
    window.customizeEmojiPicker();
  }, 500);
});
