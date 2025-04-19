// Utilidades para Supabase

// Función para verificar si se está usando Supabase
function isUsingSupabase() {
  // Si no hay una preferencia guardada, usar Supabase por defecto
  if (localStorage.getItem('useSupabase') === null) {
    localStorage.setItem('useSupabase', 'true');
    return true;
  }
  return localStorage.getItem('useSupabase') === 'true';
}

// Función para activar Supabase
function enableSupabase() {
  localStorage.setItem('useSupabase', 'true');
  console.log('Supabase activado');
  return true;
}

// Función para desactivar Supabase
function disableSupabase() {
  localStorage.setItem('useSupabase', 'false');
  console.log('Supabase desactivado');
  return true;
}

// Función para inicializar Supabase
async function initSupabase() {
  try {
    console.log('Inicializando Supabase...');

    // Verificar si la configuración de Supabase está disponible
    if (typeof getSupabaseClient !== 'function') {
      console.error('Error: La función getSupabaseClient no está disponible');
      return false;
    }

    // Verificar la conexión con Supabase
    try {
      // Usar la tabla 'health_check' que ahora existe
      const { data, error } = await getSupabaseClient().from('health_check').select('*').limit(1);

      if (error) {
        console.error('Error al verificar la conexión con Supabase:', error);
        // Intentar con la tabla 'transactions' como alternativa
        try {
          const { data: transData, error: transError } = await getSupabaseClient().from('transactions').select('*').limit(1);

          if (transError) {
            console.error('Error al verificar la conexión con Supabase (transactions):', transError);
            return false;
          }

          console.log('Conexión con Supabase establecida correctamente (usando transactions)');
          return true;
        } catch (fallbackError) {
          console.error('Error en la verificación alternativa:', fallbackError);
          return false;
        }
      }

      console.log('Conexión con Supabase establecida correctamente');
      return true;
    } catch (error) {
      console.error('Error al inicializar Supabase:', error);
      return false;
    }
  } catch (error) {
    console.error('Error general al inicializar Supabase:', error);
    return false;
  }
}

// Exponer las funciones globalmente
window.isUsingSupabase = isUsingSupabase;
window.enableSupabase = enableSupabase;
window.disableSupabase = disableSupabase;
window.initSupabase = initSupabase;
