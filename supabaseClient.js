// Supabase Client
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './appInit.js';

// Inicializar con valores por defecto
let supabaseUrl = 'https://dtptlcnrjksepidiyeku.supabase.co';
let supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cHRsY25yamtzZXBpZGl5ZWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjMwNDAsImV4cCI6MjA2MDUzOTA0MH0.iRG9by85-brZXIkF7E3ko_2cuaiq7AkRfxppCHu6xW8';

// Crear cliente de Supabase
let supabase = createClient(supabaseUrl, supabaseAnonKey);

// Función para inicializar el cliente de Supabase con las credenciales correctas
export async function initSupabaseClient() {
  try {
    // Obtener configuración de Supabase desde el servidor
    const config = await getSupabaseConfig();

    if (config && config.supabaseUrl && config.supabaseAnonKey) {
      supabaseUrl = config.supabaseUrl;
      supabaseAnonKey = config.supabaseAnonKey;

      // Recrear el cliente con las credenciales correctas
      supabase = createClient(supabaseUrl, supabaseAnonKey);

      console.log('Cliente de Supabase inicializado correctamente');
      return true;
    } else {
      console.warn('No se pudieron obtener las credenciales de Supabase');
      return false;
    }
  } catch (error) {
    console.error('Error al inicializar el cliente de Supabase:', error);
    return false;
  }
}

export { supabase };
