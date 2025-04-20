// Script de diagnóstico para la aplicación

// Función para verificar el estado de la aplicación
function diagnosticCheck(showNotificationToUser = false) {
  console.log('=== DIAGNÓSTICO DE LA APLICACIÓN ===');

  // Verificar variables globales críticas
  console.log('--- Variables Globales ---');
  console.log('window.transactions:', Array.isArray(window.transactions) ? `Array con ${window.transactions.length} elementos` : typeof window.transactions);
  console.log('window.categories:', Array.isArray(window.categories) ? `Array con ${window.categories.length} elementos` : typeof window.categories);
  console.log('window.savingsBalance:', window.savingsBalance);
  console.log('window.savingsHistory:', Array.isArray(window.savingsHistory) ? `Array con ${window.savingsHistory.length} elementos` : typeof window.savingsHistory);

  // Verificar funciones críticas
  console.log('--- Funciones Críticas ---');
  console.log('updateDashboard:', typeof window.updateDashboard === 'function' ? 'Disponible' : 'No disponible');
  console.log('updateHistoryList:', typeof window.updateHistoryList === 'function' ? 'Disponible' : 'No disponible');
  console.log('updateSavingsDisplay:', typeof window.updateSavingsDisplay === 'function' ? 'Disponible' : 'No disponible');
  console.log('getTransactions:', typeof window.getTransactions === 'function' ? 'Disponible' : 'No disponible');
  console.log('getUserTransactions:', typeof window.getUserTransactions === 'function' ? 'Disponible' : 'No disponible');
  console.log('getTransactionById:', typeof window.getTransactionById === 'function' ? 'Disponible' : 'No disponible');

  // Verificar estado de Supabase
  console.log('--- Estado de Supabase ---');
  console.log('useSupabase:', localStorage.getItem('useSupabase') === 'true' ? 'Activado' : 'Desactivado');
  console.log('supabaseClient disponible:', typeof window.getSupabaseClient === 'function' ? 'Sí' : 'No');

  // Verificar estado de la sesión
  console.log('--- Estado de la Sesión ---');
  console.log('userId en sessionStorage:', sessionStorage.getItem('userId'));
  console.log('isAdmin en sessionStorage:', sessionStorage.getItem('isAdmin'));

  // Verificar elementos del DOM críticos
  console.log('--- Elementos del DOM ---');
  console.log('loginSection:', document.getElementById('loginSection') ? 'Existe' : 'No existe');
  console.log('content:', document.getElementById('content') ? 'Existe' : 'No existe');
  console.log('navbar:', document.querySelector('.navbar') ? 'Existe' : 'No existe');

  console.log('=== FIN DEL DIAGNÓSTICO ===');

  // Crear objeto de resultados
  const results = {
    transactions: Array.isArray(window.transactions),
    categories: Array.isArray(window.categories),
    savingsBalance: typeof window.savingsBalance === 'number' || window.savingsBalance instanceof HTMLElement,
    savingsHistory: Array.isArray(window.savingsHistory),
    updateDashboard: typeof window.updateDashboard === 'function',
    updateHistoryList: typeof window.updateHistoryList === 'function',
    updateSavingsDisplay: typeof window.updateSavingsDisplay === 'function',
    getTransactions: typeof window.getTransactions === 'function',
    getUserTransactions: typeof window.getUserTransactions === 'function',
    getTransactionById: typeof window.getTransactionById === 'function',
    useSupabase: localStorage.getItem('useSupabase') === 'true',
    supabaseClient: typeof window.getSupabaseClient === 'function',
    userId: !!sessionStorage.getItem('userId'),
    isAdmin: !!sessionStorage.getItem('isAdmin'),
    loginSection: !!document.getElementById('loginSection'),
    content: !!document.getElementById('content'),
    navbar: !!document.querySelector('.navbar')
  };

  // Verificar si hay problemas
  const problems = [];

  if (!results.transactions) problems.push('window.transactions no es un array');
  if (!results.categories) problems.push('window.categories no es un array');
  if (!results.savingsHistory) problems.push('window.savingsHistory no es un array');
  if (!results.updateDashboard) problems.push('updateDashboard no está disponible');
  if (!results.updateHistoryList) problems.push('updateHistoryList no está disponible');
  if (!results.updateSavingsDisplay) problems.push('updateSavingsDisplay no está disponible');
  if (!results.getTransactions) problems.push('getTransactions no está disponible');
  if (!results.getTransactionById) problems.push('getTransactionById no está disponible');

  // Mostrar notificación al usuario solo si hay problemas o si se solicita explícitamente
  if (typeof showNotification === 'function' && (problems.length > 0 || showNotificationToUser)) {
    if (problems.length > 0) {
      showNotification('Diagnóstico', `Se encontraron ${problems.length} problemas. Revisa la consola para más detalles.`, 'warning');
    } else if (showNotificationToUser) {
      showNotification('Diagnóstico', 'Diagnóstico completado. Todo está funcionando correctamente.', 'success');
    }
  }

  return {
    results,
    problems,
    hasProblems: problems.length > 0
  };
}

// Exponer la función globalmente
window.diagnosticCheck = diagnosticCheck;

// Ejecutar el diagnóstico automáticamente después de 5 segundos, pero sin mostrar notificación
setTimeout(() => {
  console.log('Ejecutando diagnóstico automático...');
  diagnosticCheck(false); // No mostrar notificación a menos que haya problemas
}, 5000);
