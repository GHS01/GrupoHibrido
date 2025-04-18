// Implementación de UUID v4 sin dependencias de módulos

// Función para generar UUIDs v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Exponer la función globalmente
window.uuidv4 = uuidv4;

// Crear un objeto compatible con la biblioteca uuid
window.uuid = {
  v4: uuidv4
};

// Exportar para uso como módulo (si es necesario)
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    v4: uuidv4
  };
}
