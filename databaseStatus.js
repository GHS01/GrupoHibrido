// Función para mostrar el estado de la conexión con Supabase
async function showDatabaseStatus() {
  try {
    // Verificar si se está usando Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';

    // Obtener el elemento de estado
    const statusElement = document.getElementById('databaseStatus');
    if (!statusElement) return;

    if (useSupabase) {
      // Verificar la conexión con Supabase
      try {
        const { data, error } = await getSupabaseClient().from('transactions').select('*').limit(1);

        if (error) {
          console.error('Error al verificar la conexión con Supabase:', error);
          statusElement.innerHTML = `
            <div class="alert alert-danger">
              <i class="fas fa-exclamation-triangle"></i>
              Error de conexión con Supabase
            </div>
          `;
          return;
        }

        // Conexión exitosa
        statusElement.innerHTML = `
          <div class="alert alert-success">
            <i class="fas fa-check-circle"></i>
            Conectado a Supabase
          </div>
        `;
      } catch (error) {
        console.error('Error al verificar la conexión con Supabase:', error);
        statusElement.innerHTML = `
          <div class="alert alert-warning">
            <i class="fas fa-exclamation-triangle"></i>
            Conexión inestable con Supabase
          </div>
        `;
      }
    } else {
      // Usando IndexedDB
      statusElement.innerHTML = `
        <div class="alert alert-info">
          <i class="fas fa-database"></i>
          Usando base de datos local (IndexedDB)
        </div>
      `;
    }
  } catch (error) {
    console.error('Error al mostrar el estado de la base de datos:', error);
  }
}

// Función para cambiar entre Supabase e IndexedDB
async function toggleDatabaseMode() {
  try {
    // Obtener el estado actual
    const useSupabase = localStorage.getItem('useSupabase') === 'true';

    // Mostrar confirmación
    const confirmed = await showConfirmDialog({
      title: `Confirmar cambio de base de datos`,
      message: useSupabase
        ? '¿Está seguro de cambiar a la base de datos local (IndexedDB)? Sus datos en la nube seguirán disponibles cuando vuelva a conectarse.'
        : '¿Está seguro de cambiar a la base de datos en la nube (Supabase)? Sus datos locales se sincronizarán con la nube.',
      icon: '🔄',
      confirmText: 'Cambiar',
      isDanger: false
    });

    if (!confirmed) return;

    // Cambiar el modo
    localStorage.setItem('useSupabase', (!useSupabase).toString());

    // Si se está cambiando a Supabase, verificar la autenticación
    if (!useSupabase) {
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        // No hay usuario autenticado, mostrar formulario de inicio de sesión
        showNotification('Información', 'Debe iniciar sesión para usar la base de datos en la nube', 'info');

        // Volver a modo local
        localStorage.setItem('useSupabase', 'false');
        showDatabaseStatus();
        return;
      }
    }

    // Actualizar el estado
    showDatabaseStatus();

    // Mostrar notificación
    showNotification('¡Éxito!', `Modo de base de datos cambiado a ${!useSupabase ? 'Supabase (nube)' : 'IndexedDB (local)'}`, 'success');

    // Recargar los datos
    if (typeof window.loadUserData === 'function') {
      const userId = sessionStorage.getItem('userId');
      if (userId) {
        await window.loadUserData(userId);
        updateDashboard();
        updateHistoryList();
        updateCategoryList();
      }
    }
  } catch (error) {
    console.error('Error al cambiar el modo de base de datos:', error);
    showNotification('Error', 'No se pudo cambiar el modo de base de datos', 'error');
  }
}

// Exponer las funciones globalmente
window.showDatabaseStatus = showDatabaseStatus;
window.toggleDatabaseMode = toggleDatabaseMode;
