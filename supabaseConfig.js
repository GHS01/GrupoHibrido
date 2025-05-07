// Configuración global de Supabase (versión no modular)
const SUPABASE_URL = 'https://dtptlcnrjksepidiyeku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8';

// Inicializar el cliente de Supabase globalmente
let supabaseClient = null;

// Variable para controlar si se usa Supabase o IndexedDB
let useSupabase = localStorage.getItem('useSupabase') === 'true';

// Función para inicializar el cliente de Supabase
async function initSupabase() {
  try {
    // Verificar si el usuario ha activado Supabase
    useSupabase = localStorage.getItem('useSupabase') === 'true';
    console.log('¿Usar Supabase?', useSupabase);

    // Si no está activado, no continuar
    if (!useSupabase) {
      console.log('Supabase no está activado, no se inicializará');
      return;
    }

    // Verificar si la biblioteca de Supabase está disponible
    if (typeof supabase === 'undefined') {
      console.error('La biblioteca de Supabase no está disponible. Asegúrate de incluir el script de Supabase.');
      throw new Error('Supabase no disponible');
    }

    // Limpiar cualquier sesión anterior que pueda estar causando problemas
    try {
      const existingClient = getSupabaseClient();
      if (existingClient && existingClient.auth) {
        console.log('Verificando estado de sesión antes de inicializar...');
        const { data: sessionData } = await existingClient.auth.getSession();
        if (!sessionData || !sessionData.session) {
          console.log('No hay sesión activa, se inicializará un nuevo cliente');
        } else {
          console.log('Sesión activa encontrada, se usará el cliente existente');
          return;
        }
      }
    } catch (sessionCheckError) {
      console.warn('Error al verificar sesión existente:', sessionCheckError);
    }

    // Verificar si ya tenemos las credenciales en localStorage
    const storedUrl = localStorage.getItem('supabaseUrl');
    const storedKey = localStorage.getItem('supabaseAnonKey');

    if (storedUrl && storedKey) {
      console.log('Usando credenciales de Supabase almacenadas localmente');
      try {
        supabaseClient = supabase.createClient(storedUrl, storedKey);
        console.log('Cliente de Supabase inicializado correctamente con credenciales locales');
        return;
      } catch (localError) {
        console.error('Error al inicializar con credenciales locales:', localError);
        // Continuamos con los siguientes métodos
      }
    }

    // Intentar obtener la configuración desde el servidor
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        if (config.supabaseUrl && config.supabaseAnonKey) {
          // Guardar en localStorage para futuras sesiones
          localStorage.setItem('supabaseUrl', config.supabaseUrl);
          localStorage.setItem('supabaseAnonKey', config.supabaseAnonKey);

          try {
            supabaseClient = supabase.createClient(
              config.supabaseUrl,
              config.supabaseAnonKey
            );
            console.log('Cliente de Supabase inicializado con configuración del servidor');
            return;
          } catch (serverError) {
            console.error('Error al inicializar con credenciales del servidor:', serverError);
            // Continuamos con los valores por defecto
          }
        }
      }
    } catch (error) {
      console.warn('No se pudo obtener la configuración del servidor:', error);
    }

    // Si no se pudo obtener la configuración del servidor, usar valores por defecto
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Cliente de Supabase inicializado con valores por defecto');

      // Guardar los valores por defecto en localStorage
      localStorage.setItem('supabaseUrl', SUPABASE_URL);
      localStorage.setItem('supabaseAnonKey', SUPABASE_ANON_KEY);
    } catch (defaultError) {
      console.error('Error al inicializar con valores por defecto:', defaultError);
      // Crear un cliente simulado como último recurso
      supabaseClient = createFallbackClient();
    }
  } catch (error) {
    console.error('Error al inicializar Supabase:', error);
    // Crear un cliente simulado como último recurso
    supabaseClient = createFallbackClient();
  }
}

// Función para obtener el cliente de Supabase
function getSupabaseClient() {
  // Verificar si se está usando Supabase
  useSupabase = localStorage.getItem('useSupabase') === 'true';
  if (!useSupabase) {
    console.log('Supabase está desactivado. Usando cliente simulado.');
    return createFallbackClient();
  }

  if (!supabaseClient) {
    try {
      // Verificar si la biblioteca de Supabase está disponible
      if (typeof supabase === 'undefined') {
        console.error('La biblioteca de Supabase no está disponible. Asegúrate de incluir el script de Supabase.');
        throw new Error('Supabase no disponible');
      }

      // Si no está inicializado, inicializar con valores por defecto
      const storedUrl = localStorage.getItem('supabaseUrl') || SUPABASE_URL;
      const storedKey = localStorage.getItem('supabaseAnonKey') || SUPABASE_ANON_KEY;

      // Configurar opciones de persistencia para mantener la sesión entre recargas
      const options = {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'supabase-auth'
        }
      };

      supabaseClient = supabase.createClient(storedUrl, storedKey, options);
      console.log('Cliente de Supabase inicializado bajo demanda con persistencia de sesión');

      // Verificar que el cliente se haya creado correctamente
      if (!supabaseClient || !supabaseClient.auth || !supabaseClient.from) {
        console.error('El cliente de Supabase no se inicializó correctamente');
        throw new Error('Cliente de Supabase inválido');
      }
    } catch (error) {
      console.error('Error al inicializar el cliente de Supabase:', error);
      // Intentar con valores por defecto si hay un error
      try {
        // Configurar opciones de persistencia para mantener la sesión entre recargas
        const options = {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            storageKey: 'supabase-auth'
          }
        };

        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
        console.log('Cliente de Supabase inicializado con valores por defecto y persistencia de sesión');
      } catch (fallbackError) {
        console.error('Error crítico al inicializar Supabase con valores por defecto:', fallbackError);
        // Crear un cliente simulado para evitar errores en la aplicación
        supabaseClient = createFallbackClient();
      }
    }
  }
  return supabaseClient;
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

// Función para verificar si se está usando Supabase
function isUsingSupabase() {
  return useSupabase;
}

// Función para activar el uso de Supabase
function enableSupabase() {
  useSupabase = true;
  localStorage.setItem('useSupabase', 'true');
  console.log('Supabase activado');
}

// Función para desactivar el uso de Supabase
function disableSupabase() {
  useSupabase = false;
  localStorage.removeItem('useSupabase');
  console.log('Supabase desactivado');
}

// Función para probar la conexión a Supabase
async function testConnection() {
  try {
    // Intentar con método estándar primero
    const { data, error } = await getSupabaseClient()
      .from('teams')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Error al probar conexión con método estándar:', error);

      // Intentar con SQL directo como respaldo
      try {
        const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
          sql_query: 'SELECT to_json(array_agg(t.*)) FROM public.teams t LIMIT 5'
        });

        if (sqlError) throw sqlError;

        console.log('Conexión exitosa (SQL directo). Equipos:', sqlData);
        return { success: true, message: `Conexión exitosa (SQL directo). Se encontraron ${sqlData ? sqlData.length : 0} equipos.`, data: sqlData };
      } catch (sqlError) {
        console.error('Error al probar conexión con SQL directo:', sqlError);
        throw sqlError;
      }
    } else {
      console.log('Conexión exitosa. Equipos:', data);
      return { success: true, message: `Conexión exitosa. Se encontraron ${data.length} equipos.`, data };
    }
  } catch (error) {
    console.error('Error en la prueba de conexión:', error);
    return { success: false, message: `Error: ${error.message}`, error };
  }
}

// Exponer las funciones globalmente
window.getSupabaseClient = getSupabaseClient;
window.initSupabase = initSupabase;
window.isUsingSupabase = isUsingSupabase;
window.enableSupabase = enableSupabase;
window.disableSupabase = disableSupabase;
window.testSupabaseConnection = testConnection;

// Inicializar Supabase cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
