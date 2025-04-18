// Configuración global de Supabase (versión no modular)
const SUPABASE_URL = 'https://dtptlcnrjksepidiyeku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8';

// Inicializar el cliente de Supabase globalmente
let supabaseClient = null;

// Función para inicializar el cliente de Supabase
async function initSupabase() {
  try {
    // Intentar obtener la configuración desde el servidor
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        if (config.supabaseUrl && config.supabaseAnonKey) {
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
  } catch (error) {
    console.error('Error al inicializar Supabase:', error);
  }
}

// Función para obtener el cliente de Supabase
function getSupabaseClient() {
  if (!supabaseClient) {
    // Si no está inicializado, inicializar con valores por defecto
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.warn('Inicializando cliente de Supabase con valores por defecto');
  }
  return supabaseClient;
}

// Inicializar Supabase cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
