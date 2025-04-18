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
    try {
      // Verificar si la biblioteca de Supabase está disponible
      if (typeof window.supabase === 'undefined') {
        console.error('La biblioteca de Supabase no está disponible. Asegúrate de incluir el script de Supabase.');
        throw new Error('Supabase no disponible');
      }

      supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
      console.log('Cliente de Supabase inicializado correctamente');

      // Verificar que el cliente se haya creado correctamente
      if (!supabase || !supabase.auth || !supabase.from) {
        console.error('El cliente de Supabase no se inicializó correctamente');
        throw new Error('Cliente de Supabase inválido');
      }
    } catch (error) {
      console.error('Error al inicializar el cliente de Supabase:', error);
      // Intentar con valores por defecto si hay un error
      try {
        supabase = window.supabase.createClient(
          'https://dtptlcnrjksepidiyeku.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8'
        );
        console.log('Cliente de Supabase inicializado con valores por defecto');
      } catch (fallbackError) {
        console.error('Error crítico al inicializar Supabase con valores por defecto:', fallbackError);
        // Crear un cliente simulado para evitar errores en la aplicación
        supabase = createFallbackClient();
      }
    }
  }
  return supabase;
}

// Función para crear un cliente simulado en caso de error crítico
function createFallbackClient() {
  console.warn('Usando cliente de Supabase simulado. La funcionalidad será limitada.');
  // Devolver un objeto con la misma estructura pero que registra errores
  return {
    auth: {
      signUp: () => Promise.reject(new Error('Supabase no disponible')),
      signInWithPassword: () => Promise.reject(new Error('Supabase no disponible')),
      signOut: () => Promise.reject(new Error('Supabase no disponible')),
      getUser: () => Promise.resolve({ data: { user: null }, error: new Error('Supabase no disponible') })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.reject(new Error('Supabase no disponible'))
        }),
        limit: () => Promise.reject(new Error('Supabase no disponible'))
      }),
      insert: () => Promise.reject(new Error('Supabase no disponible')),
      update: () => Promise.reject(new Error('Supabase no disponible')),
      delete: () => Promise.reject(new Error('Supabase no disponible'))
    }),
    rpc: () => Promise.reject(new Error('Supabase no disponible'))
  };
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

      // Intentar inicializar el cliente con las credenciales almacenadas
      try {
        supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        console.log('Cliente de Supabase inicializado correctamente con credenciales locales');
        return true;
      } catch (localError) {
        console.error('Error al inicializar con credenciales locales:', localError);
        // Continuamos con los siguientes métodos
      }
    }

    // Intentar obtener configuración desde el servidor
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`Error en la respuesta del servidor: ${response.status}`);
      }

      const config = await response.json();

      if (config && config.supabaseUrl && config.supabaseAnonKey) {
        supabaseUrl = config.supabaseUrl;
        supabaseAnonKey = config.supabaseAnonKey;

        // Guardar en localStorage para futuras sesiones
        localStorage.setItem('supabaseUrl', supabaseUrl);
        localStorage.setItem('supabaseAnonKey', supabaseAnonKey);

        // Forzar recreación del cliente
        supabase = null;

        // Intentar inicializar con las nuevas credenciales
        try {
          supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
          console.log('Cliente de Supabase inicializado con credenciales del servidor');
          return true;
        } catch (serverCredError) {
          console.error('Error al inicializar con credenciales del servidor:', serverCredError);
          // Continuamos con los valores por defecto
        }
      }
    } catch (fetchError) {
      console.warn('No se pudieron obtener las credenciales del servidor:', fetchError);
      // Continuamos con los valores por defecto
    }

    // Si llegamos aquí, usamos los valores por defecto
    console.log('Usando credenciales de Supabase por defecto');
    supabase = null; // Forzar recreación del cliente

    // Intentar inicializar con valores por defecto
    try {
      supabase = window.supabase.createClient(
        'https://dtptlcnrjksepidiyeku.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8'
      );
      console.log('Cliente de Supabase inicializado con valores por defecto');
      return true;
    } catch (defaultError) {
      console.error('Error al inicializar con valores por defecto:', defaultError);
      // Crear un cliente simulado como último recurso
      supabase = createFallbackClient();
      return false;
    }
  } catch (error) {
    console.error('Error al inicializar el cliente de Supabase:', error);
    // Crear un cliente simulado como último recurso
    supabase = createFallbackClient();
    return false;
  }
}

// Exponer las funciones globalmente
window.getSupabaseClient = getSupabaseClient;
window.initSupabaseClient = initSupabaseClient;

// Exportar para uso en módulos
export { getSupabaseClient, initSupabaseClient };
