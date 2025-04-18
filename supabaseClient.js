// Supabase Client
// Usar la versión global de Supabase proporcionada por el CDN

// Inicializar con valores por defecto
let supabaseUrl = 'https://dtptlcnrjksepidiyeku.supabase.co';
let supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8';

// Crear cliente de Supabase usando la versión global
let supabase = null;

// Función para obtener el cliente de Supabase
function getSupabaseClient() {
  if (!supabase) {
    console.log('Inicializando cliente de Supabase con URL:', supabaseUrl);
    supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

// Función para inicializar el cliente de Supabase con las credenciales correctas
async function initSupabaseClient() {
  try {
    // Verificar si ya tenemos las credenciales en localStorage
    const storedUrl = localStorage.getItem('supabaseUrl');
    const storedKey = localStorage.getItem('supabaseAnonKey');

    if (storedUrl && storedKey) {
      console.log('Usando credenciales de Supabase almacenadas localmente');
      supabaseUrl = storedUrl;
      supabaseAnonKey = storedKey;
      supabase = null; // Forzar recreación del cliente
      return true;
    }

    // Intentar obtener configuración desde el servidor
    try {
      const response = await fetch('/api/config');
      const config = await response.json();

      if (config && config.supabaseUrl && config.supabaseAnonKey) {
        supabaseUrl = config.supabaseUrl;
        supabaseAnonKey = config.supabaseAnonKey;

        // Guardar en localStorage para futuras sesiones
        localStorage.setItem('supabaseUrl', supabaseUrl);
        localStorage.setItem('supabaseAnonKey', supabaseAnonKey);

        // Forzar recreación del cliente
        supabase = null;

        console.log('Cliente de Supabase inicializado con credenciales del servidor');
        return true;
      }
    } catch (fetchError) {
      console.warn('No se pudieron obtener las credenciales del servidor:', fetchError);
      // Continuamos con los valores por defecto
    }

    // Si llegamos aquí, usamos los valores por defecto
    console.log('Usando credenciales de Supabase por defecto');
    supabase = null; // Forzar recreación del cliente
    return true;
  } catch (error) {
    console.error('Error al inicializar el cliente de Supabase:', error);
    return false;
  }
}

// Exponer las funciones globalmente
window.getSupabaseClient = getSupabaseClient;
window.initSupabaseClient = initSupabaseClient;

// Exportar para uso en módulos
export { getSupabaseClient, initSupabaseClient };
