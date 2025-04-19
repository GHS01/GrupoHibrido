// Script para probar los botones de reinicio

console.log('=== INICIANDO PRUEBA DE BOTONES DE REINICIO ===');

// Verificar que las funciones de reinicio estén disponibles
console.log('Verificando funciones de reinicio...');
console.log('window.resetApplication:', typeof window.resetApplication === 'function' ? 'Disponible ✅' : 'No disponible ❌');
console.log('window.resetSavings:', typeof window.resetSavings === 'function' ? 'Disponible ✅' : 'No disponible ❌');

// Verificar que los botones existan
console.log('\nVerificando botones de reinicio...');
const resetButton = document.getElementById('resetButton');
console.log('Botón resetButton:', resetButton ? 'Encontrado ✅' : 'No encontrado ❌');

const resetSavingsButton = document.getElementById('resetSavingsButton');
console.log('Botón resetSavingsButton:', resetSavingsButton ? 'Encontrado ✅' : 'No encontrado ❌');

// Verificar el modo de base de datos actual
console.log('\nVerificando modo de base de datos...');
const useSupabase = localStorage.getItem('useSupabase') === 'true';
console.log('¿Usar Supabase?', useSupabase ? 'Sí ✅' : 'No ❌');

// Verificar la autenticación de Supabase
if (useSupabase) {
  console.log('\nVerificando autenticación de Supabase...');
  if (typeof getSupabaseClient === 'function') {
    getSupabaseClient().auth.getUser().then(({ data: { user } }) => {
      console.log('Usuario autenticado:', user ? `${user.id} ✅` : 'No autenticado ❌');
    }).catch(error => {
      console.error('Error al verificar usuario:', error);
    });
  } else {
    console.error('La función getSupabaseClient no está disponible ❌');
  }
}

// Verificar datos actuales
console.log('\nVerificando datos actuales...');
console.log('Transacciones:', window.transactions ? `${window.transactions.length} transacciones` : 'No disponible ❌');
console.log('Historial de ahorros:', window.savingsHistory ? `${window.savingsHistory.length} entradas` : 'No disponible ❌');
console.log('Saldo de ahorros:', window.savingsBalance !== undefined ? `S/. ${window.savingsBalance}` : 'No disponible ❌');

// Verificar tablas en Supabase
if (useSupabase && typeof checkRequiredTables === 'function') {
  console.log('\nVerificando tablas en Supabase...');
  checkRequiredTables().then(tableStatus => {
    console.log('Estado de las tablas:');
    console.log('- transactions:', tableStatus.transactions ? 'Existe ✅' : 'No existe ❌');
    console.log('- savings:', tableStatus.savings ? 'Existe ✅' : 'No existe ❌');
    console.log('- savings_history:', tableStatus.savings_history ? 'Existe ✅' : 'No existe ❌');
    console.log('- health_check:', tableStatus.health_check ? 'Existe ✅' : 'No existe ❌');
  }).catch(error => {
    console.error('Error al verificar tablas:', error);
  });
}

console.log('\n=== PRUEBA DE BOTONES DE REINICIO COMPLETADA ===');

// Instrucciones para el usuario
console.log('\nPara probar los botones de reinicio:');
console.log('1. Ve a la sección "Configuración" (Settings)');
console.log('2. Haz clic en el botón "Reiniciar Aplicación" para eliminar todas las transacciones, ahorros e historial de ahorros');
console.log('3. Haz clic en el botón "Reiniciar Saldo/Ahorros" para eliminar solo el historial de ahorros y reiniciar el saldo');
console.log('4. Verifica en la consola los mensajes de depuración para confirmar que las funciones se ejecutan correctamente');

// Función para simular clic en los botones (solo para pruebas)
window.testResetButtons = {
  resetApplication: function() {
    console.log('\n=== SIMULANDO CLIC EN BOTÓN REINICIAR APLICACIÓN ===');
    if (resetButton && typeof window.resetApplication === 'function') {
      resetButton.click();
      return true;
    }
    return false;
  },
  
  resetSavings: function() {
    console.log('\n=== SIMULANDO CLIC EN BOTÓN REINICIAR SALDO/AHORROS ===');
    if (resetSavingsButton && typeof window.resetSavings === 'function') {
      resetSavingsButton.click();
      return true;
    }
    return false;
  }
};
