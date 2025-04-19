// Script para probar los botones de reinicio

console.log('Iniciando prueba de botones de reinicio...');

// Verificar que las funciones de reinicio estén disponibles
console.log('Verificando funciones de reinicio...');
console.log('window.resetApplication:', typeof window.resetApplication === 'function' ? 'Disponible' : 'No disponible');
console.log('window.resetSavings:', typeof window.resetSavings === 'function' ? 'Disponible' : 'No disponible');

// Verificar que los botones existan
console.log('Verificando botones de reinicio...');
const resetButton = document.getElementById('resetButton');
console.log('Botón resetButton:', resetButton ? 'Encontrado' : 'No encontrado');

const resetSavingsButton = document.getElementById('resetSavingsButton');
console.log('Botón resetSavingsButton:', resetSavingsButton ? 'Encontrado' : 'No encontrado');

// Verificar que los event listeners estén configurados
console.log('Verificando event listeners...');
if (resetButton) {
  const resetButtonListeners = getEventListeners(resetButton);
  console.log('Event listeners para resetButton:', resetButtonListeners);
}

if (resetSavingsButton) {
  const resetSavingsButtonListeners = getEventListeners(resetSavingsButton);
  console.log('Event listeners para resetSavingsButton:', resetSavingsButtonListeners);
}

// Función para obtener los event listeners (solo funciona en la consola del navegador)
function getEventListeners(element) {
  try {
    // Esta función solo funciona en la consola del navegador
    // En un script normal, no podemos acceder a los event listeners directamente
    return 'No se pueden obtener los event listeners desde un script. Verifica manualmente en la consola del navegador.';
  } catch (error) {
    return 'No se pueden obtener los event listeners: ' + error.message;
  }
}

// Verificar el modo de base de datos actual
console.log('Verificando modo de base de datos...');
const useSupabase = localStorage.getItem('useSupabase') === 'true';
console.log('¿Usar Supabase?', useSupabase);

// Verificar la autenticación de Supabase
if (useSupabase) {
  console.log('Verificando autenticación de Supabase...');
  if (typeof getSupabaseClient === 'function') {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      console.log('Usuario autenticado:', user ? user.id : 'No autenticado');
    }).catch(error => {
      console.error('Error al verificar usuario:', error);
    });
  } else {
    console.error('La función getSupabaseClient no está disponible');
  }
}

// Verificar datos actuales
console.log('Verificando datos actuales...');
console.log('Transacciones:', window.transactions ? window.transactions.length : 'No disponible');
console.log('Historial de ahorros:', window.savingsHistory ? window.savingsHistory.length : 'No disponible');
console.log('Saldo de ahorros:', window.savingsBalance);

console.log('Prueba de botones de reinicio completada');

// Instrucciones para el usuario
console.log('\nPara probar los botones de reinicio:');
console.log('1. Ve a la sección "Configuración" (Settings)');
console.log('2. Haz clic en el botón "Reiniciar Aplicación" para eliminar todas las transacciones');
console.log('3. Haz clic en el botón "Reiniciar Saldo/Ahorros" para eliminar el historial de ahorros y reiniciar el saldo');
console.log('4. Verifica en la consola los mensajes de depuración para confirmar que las funciones se ejecutan correctamente');
