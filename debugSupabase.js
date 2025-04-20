// Función para depurar la integración con Supabase (solo consola, sin elementos visuales)
function debugSupabaseIntegration() {
  // Solo mostrar logs si estamos en modo debug
  if (!window.location.href.includes('debug=true')) {
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
  console.log('window.savingsBalance:', window.savingsBalance);
  console.log('window.savingsHistory:', window.savingsHistory ? window.savingsHistory.length : 'no definido');
}

// Ejecutar la depuración cuando se cargue la página, pero solo si estamos en modo debug
document.addEventListener('DOMContentLoaded', function() {
  // Esperar a que se carguen los datos
  if (window.location.href.includes('debug=true')) {
    setTimeout(debugSupabaseIntegration, 2000);
  }
});
