// Interfaz de usuario para la migración de IndexedDB a Supabase
import { migrateToSupabase } from './migrationService.js';

// Función para mostrar la interfaz de migración
export function showMigrationUI() {
  // Crear el modal de migración
  const modalHtml = `
    <div class="modal fade" id="migrationModal" tabindex="-1" aria-labelledby="migrationModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="migrationModalLabel">Migración a Supabase</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Esta herramienta migrará todos sus datos de IndexedDB a Supabase, una base de datos en la nube.</p>
            <p>Beneficios de la migración:</p>
            <ul>
              <li>Acceso a sus datos desde cualquier dispositivo</li>
              <li>Mayor seguridad y respaldo de datos</li>
              <li>Mejor rendimiento y escalabilidad</li>
              <li>Sincronización en tiempo real</li>
            </ul>
            <p>La migración puede tardar unos minutos dependiendo de la cantidad de datos.</p>
            <div class="progress mb-3" style="display: none;">
              <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
            </div>
            <div id="migrationStatus"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="startMigrationBtn">Iniciar Migración</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Agregar el modal al DOM
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
  
  // Mostrar el modal
  const migrationModal = new bootstrap.Modal(document.getElementById('migrationModal'));
  migrationModal.show();
  
  // Configurar el botón de inicio de migración
  const startMigrationBtn = document.getElementById('startMigrationBtn');
  startMigrationBtn.addEventListener('click', async () => {
    // Deshabilitar el botón durante la migración
    startMigrationBtn.disabled = true;
    
    // Mostrar la barra de progreso
    const progressBar = document.querySelector('.progress');
    progressBar.style.display = 'block';
    const progressBarInner = progressBar.querySelector('.progress-bar');
    
    // Actualizar el estado
    const statusDiv = document.getElementById('migrationStatus');
    statusDiv.innerHTML = '<div class="alert alert-info">Iniciando migración...</div>';
    
    try {
      // Simular progreso
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress > 90) {
          clearInterval(progressInterval);
        }
        progressBarInner.style.width = `${progress}%`;
      }, 500);
      
      // Iniciar la migración
      statusDiv.innerHTML = '<div class="alert alert-info">Exportando datos de IndexedDB...</div>';
      
      // Obtener la instancia de IndexedDB
      const db = window.db; // Asumiendo que la instancia de IndexedDB está disponible globalmente
      
      // Realizar la migración
      const result = await migrateToSupabase(db);
      
      // Detener la simulación de progreso
      clearInterval(progressInterval);
      progressBarInner.style.width = '100%';
      
      // Mostrar el resultado
      if (result.success) {
        statusDiv.innerHTML = '<div class="alert alert-success">Migración completada con éxito. Ahora puede acceder a sus datos desde cualquier dispositivo.</div>';
        
        // Cambiar el botón para recargar la página
        startMigrationBtn.textContent = 'Recargar Aplicación';
        startMigrationBtn.disabled = false;
        startMigrationBtn.addEventListener('click', () => {
          window.location.reload();
        });
      } else {
        statusDiv.innerHTML = `<div class="alert alert-danger">Error en la migración: ${result.message}</div>`;
        startMigrationBtn.disabled = false;
        startMigrationBtn.textContent = 'Reintentar';
      }
    } catch (error) {
      console.error('Error en la migración:', error);
      statusDiv.innerHTML = `<div class="alert alert-danger">Error inesperado: ${error.message}</div>`;
      startMigrationBtn.disabled = false;
      startMigrationBtn.textContent = 'Reintentar';
    }
  });
}

// Función para agregar un botón de migración en la sección de configuración
export function addMigrationButton() {
  // Buscar la sección de configuración
  const settingsSection = document.getElementById('settings');
  if (!settingsSection) return;
  
  // Crear el contenedor para el botón de migración
  const migrationContainer = document.createElement('div');
  migrationContainer.className = 'col-md-12 mt-4';
  migrationContainer.innerHTML = `
    <div class="card dashboard-card">
      <div class="card-body">
        <h5 class="card-title">Migración a la Nube</h5>
        <p class="card-text">Migre sus datos a Supabase para acceder a ellos desde cualquier dispositivo y mejorar la seguridad.</p>
        <button id="showMigrationBtn" class="btn btn-primary">Migrar a Supabase</button>
      </div>
    </div>
  `;
  
  // Agregar el contenedor a la sección de configuración
  settingsSection.querySelector('.row').appendChild(migrationContainer);
  
  // Configurar el botón para mostrar la interfaz de migración
  const showMigrationBtn = document.getElementById('showMigrationBtn');
  showMigrationBtn.addEventListener('click', showMigrationUI);
}
