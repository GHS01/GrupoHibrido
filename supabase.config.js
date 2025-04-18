// Configuración de Supabase para entornos de desarrollo y producción

// Función para obtener la configuración de Supabase
export async function getSupabaseConfig() {
  try {
    // Intentar obtener la configuración desde el servidor
    const response = await fetch('/api/config');

    if (!response.ok) {
      throw new Error(`Error al obtener la configuración: ${response.status}`);
    }

    const config = await response.json();

    // Verificar si la configuración contiene las credenciales de Supabase
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.warn('La configuración no contiene las credenciales de Supabase');
      return null;
    }

    return {
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey
    };
  } catch (error) {
    console.error('Error al obtener la configuración de Supabase:', error);

    // En caso de error, devolver valores por defecto para desarrollo local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.warn('Usando configuración de desarrollo local para Supabase');
      return {
        supabaseUrl: 'https://dtptlcnrjksepidiyeku.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8'
      };
    }

    return null;
  }
}
