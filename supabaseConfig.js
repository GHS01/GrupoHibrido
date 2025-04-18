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

    // Verificar si ya tenemos las credenciales en localStorage
    const storedUrl = localStorage.getItem('supabaseUrl');
    const storedKey = localStorage.getItem('supabaseAnonKey');

    if (storedUrl && storedKey) {
      console.log('Usando credenciales de Supabase almacenadas localmente');
      supabaseClient = supabase.createClient(storedUrl, storedKey);
      return;
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

          supabaseClient = supabase.createClient(
            config.supabaseUrl,
            config.supabaseAnonKey
          );
          console.log('Cliente de Supabase inicializado con configuración del servidor');
          return;
        }
      }
    } catch (error) {
      console.warn('No se pudo obtener la configuración del servidor:', error);
    }

    // Si no se pudo obtener la configuración del servidor, usar valores por defecto
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Cliente de Supabase inicializado con valores por defecto');

    // Guardar los valores por defecto en localStorage
    localStorage.setItem('supabaseUrl', SUPABASE_URL);
    localStorage.setItem('supabaseAnonKey', SUPABASE_ANON_KEY);
  } catch (error) {
    console.error('Error al inicializar Supabase:', error);
  }
}

// Función para obtener el cliente de Supabase
function getSupabaseClient() {
  if (!supabaseClient) {
    // Si no está inicializado, inicializar con valores por defecto
    const storedUrl = localStorage.getItem('supabaseUrl') || SUPABASE_URL;
    const storedKey = localStorage.getItem('supabaseAnonKey') || SUPABASE_ANON_KEY;

    supabaseClient = supabase.createClient(storedUrl, storedKey);
    console.warn('Inicializando cliente de Supabase bajo demanda');
  }
  return supabaseClient;
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

// Exponer las funciones globalmente
window.getSupabaseClient = getSupabaseClient;
window.initSupabase = initSupabase;
window.isUsingSupabase = isUsingSupabase;
window.enableSupabase = enableSupabase;
window.disableSupabase = disableSupabase;

// Inicializar Supabase cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
