// Script de depuración para la integración con Supabase (solo consola, sin elementos visuales)
(function() {
  // Función para mostrar información de depuración solo en la consola
  function logDebugInfo() {
    if (!window.location.href.includes('debug=true')) {
      // Solo mostrar información de depuración si se incluye el parámetro debug=true en la URL
      return;
    }

    console.log('=== DEPURACIÓN DE INTEGRACIÓN CON SUPABASE ===');

    // Verificar si se está usando Supabase
    const isUsingSupabase = typeof window.supabaseIntegration !== 'undefined' &&
                           typeof window.supabaseIntegration.isUsingSupabase === 'function' &&
                           window.supabaseIntegration.isUsingSupabase();

    console.log('¿Está usando Supabase?', isUsingSupabase);
    console.log('localStorage.useSupabase:', localStorage.getItem('useSupabase'));

    // Verificar si hay un usuario autenticado
    const userId = sessionStorage.getItem('userId');
    console.log('ID de usuario en sessionStorage:', userId);

    // Verificar datos financieros
    console.log('window.transactions:', window.transactions ? window.transactions.length : 'no definido');
    if (window.transactions && window.transactions.length > 0) {
      console.log('Primera transacción:', window.transactions[0]);

      // Verificar si las transacciones tienen el formato correcto
      const firstTransaction = window.transactions[0];
      console.log('Propiedades de la primera transacción:');
      console.log('- id:', firstTransaction.id);
      console.log('- userId:', firstTransaction.userId);
      console.log('- user_id:', firstTransaction.user_id);
      console.log('- type:', firstTransaction.type);
      console.log('- amount:', firstTransaction.amount);
      console.log('- category:', firstTransaction.category);
      console.log('- date:', firstTransaction.date);
      console.log('- costType:', firstTransaction.costType);
      console.log('- cost_type:', firstTransaction.cost_type);
    }

    console.log('window.savingsBalance:', window.savingsBalance);
    console.log('window.savingsHistory:', window.savingsHistory ? window.savingsHistory.length : 'no definido');

    // Verificar funciones disponibles
    console.log('Funciones disponibles:');
    console.log('- window.supabaseService.refreshData:', typeof window.supabaseService !== 'undefined' && typeof window.supabaseService.refreshData === 'function');
    console.log('- window.realtimeSync.refreshData:', typeof window.realtimeSync !== 'undefined' && typeof window.realtimeSync.refreshData === 'function');
    console.log('- window.getSupabaseClient:', typeof window.getSupabaseClient === 'function');
    console.log('- window.supabaseClient:', typeof window.supabaseClient !== 'undefined');
  }

  // Función para recargar datos sin mostrar elementos visuales
  async function reloadDataSilently() {
    try {
      if (typeof window.reloadDataFromSupabase === 'function') {
        await window.reloadDataFromSupabase();
        // Solo mostrar logs si estamos en modo debug
        if (window.location.href.includes('debug=true')) {
          console.log('Datos recargados desde Supabase');
          logDebugInfo();
        }
      }
    } catch (error) {
      if (window.location.href.includes('debug=true')) {
        console.error('Error al recargar datos desde Supabase:', error);
      }
    }
  }

  // Esperar a que se cargue la página
  window.addEventListener('load', function() {
    // Recargar datos silenciosamente después de que se cargue la página
    setTimeout(reloadDataSilently, 2000);

    // Solo mostrar información de depuración si estamos en modo debug
    if (window.location.href.includes('debug=true')) {
      setTimeout(logDebugInfo, 2500);
    }
  });

  // Exponer la función de depuración globalmente pero solo para uso en consola
  window.debugSupabase = {
    logInfo: logDebugInfo,
    reloadData: reloadDataSilently
  };
})();
