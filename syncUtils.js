// Función para alternar la sincronización automática
function toggleAutoSync() {
  const autoSyncToggle = document.getElementById('autoSyncToggle');
  const syncButtonText = document.getElementById('syncButtonText');
  
  if (autoSyncToggle.checked) {
    // Iniciar sincronización automática
    startPeriodicRefresh(30000); // 30 segundos
    syncButtonText.textContent = 'Sincronización automática activada';
    showNotification('Sincronización', 'Sincronización automática activada', 'info');
  } else {
    // Detener sincronización automática
    stopPeriodicRefresh();
    syncButtonText.textContent = 'Sincronizar datos';
    showNotification('Sincronización', 'Sincronización automática desactivada', 'info');
  }
}

// Función para inicializar la interfaz de sincronización
function initSyncUI() {
  // Verificar si se está usando Supabase
  const useSupabase = localStorage.getItem('useSupabase') === 'true';
  
  // Obtener elementos de la interfaz
  const syncButton = document.getElementById('syncButton');
  const autoSyncToggle = document.getElementById('autoSyncToggle');
  
  if (syncButton && autoSyncToggle) {
    // Mostrar u ocultar controles según si se usa Supabase
    if (useSupabase) {
      syncButton.style.display = 'inline-block';
      autoSyncToggle.parentElement.style.display = 'inline-block';
    } else {
      syncButton.style.display = 'none';
      autoSyncToggle.parentElement.style.display = 'none';
    }
  }
}

// Exportar funciones
window.toggleAutoSync = toggleAutoSync;
window.initSyncUI = initSyncUI;
