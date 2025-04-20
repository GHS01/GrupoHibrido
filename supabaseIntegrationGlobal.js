// Exponer las funciones de integración de Supabase globalmente
// Este archivo debe cargarse después de supabaseServiceNonModule.js y antes de financeAI.js

// Verificar si ya existe el objeto supabaseIntegration
if (!window.supabaseIntegration) {
  // Crear el objeto global
  window.supabaseIntegration = {};

  // Función para verificar si se está usando Supabase
  window.supabaseIntegration.isUsingSupabase = function() {
    // Verificar si el usuario ha migrado a Supabase
    return localStorage.getItem('useSupabase') === 'true';
  };

  // Función para activar el uso de Supabase
  window.supabaseIntegration.enableSupabase = function() {
    localStorage.setItem('useSupabase', 'true');
  };

  // Función para desactivar el uso de Supabase
  window.supabaseIntegration.disableSupabase = function() {
    localStorage.removeItem('useSupabase');
  };

  // Función para cargar el perfil de otro usuario
  window.supabaseIntegration.loadUserProfile = async function(userId) {
    try {
      console.log('Cargando perfil de usuario desde supabaseIntegrationGlobal:', userId);

      // Verificar si se está usando Supabase
      if (!window.supabaseIntegration.isUsingSupabase()) {
        // Usar la función original de IndexedDB
        return await window.loadUserProfile(userId);
      }

      // Importar dinámicamente el módulo supabaseIntegration.js
      try {
        const { loadUserProfile } = await import('./supabaseIntegration.js');
        return await loadUserProfile(userId);
      } catch (importError) {
        console.error('Error al importar módulo supabaseIntegration.js:', importError);

        // Intentar usar la función de supabaseService como alternativa
        if (typeof window.supabaseService !== 'undefined' && typeof window.supabaseService.loadUserProfile === 'function') {
          return await window.supabaseService.loadUserProfile(userId);
        } else {
          throw new Error('No se encontró ninguna implementación de loadUserProfile');
        }
      }
    } catch (error) {
      console.error('Error en loadUserProfile global:', error);
      window.showNotification('Error', error.message || 'Ocurrió un error al cargar el perfil', 'error');
      return false;
    }
  };

  // Función para obtener todos los usuarios
  window.supabaseIntegration.getAllUsers = async function() {
    try {
      console.log('Obteniendo todos los usuarios desde supabaseIntegrationGlobal');

      // Verificar si se está usando Supabase
      if (!window.supabaseIntegration.isUsingSupabase()) {
        // Usar la función original de IndexedDB
        return await window.getAllFromDb('users');
      }

      // Intentar usar la función de supabaseService
      if (typeof window.supabaseService !== 'undefined' && typeof window.supabaseService.getAllUsers === 'function') {
        return await window.supabaseService.getAllUsers();
      } else {
        // Importar dinámicamente el módulo supabaseIntegration.js
        try {
          const { getAllUsers } = await import('./supabaseIntegration.js');
          return await getAllUsers();
        } catch (importError) {
          console.error('Error al importar módulo supabaseIntegration.js:', importError);
          throw new Error('No se encontró ninguna implementación de getAllUsers');
        }
      }
    } catch (error) {
      console.error('Error en getAllUsers global:', error);
      window.showNotification('Error', error.message || 'Ocurrió un error al obtener los usuarios', 'error');
      return [];
    }
  };

  console.log('Funciones de integración de Supabase expuestas globalmente');
}
