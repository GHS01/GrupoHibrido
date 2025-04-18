// Interfaz de usuario para la migración de IndexedDB a Supabase (versión no modular)

// Función para mostrar la interfaz de migración
function showMigrationUI() {
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

      // Exportar datos de IndexedDB
      const users = await window.getAllFromDb('users');
      const transactions = await window.getAllFromDb('transactions');
      const categories = await window.getAllFromDb('categories');
      const savings = await window.getAllFromDb('savings');
      const teams = await window.getAllFromDb('teams');

      statusDiv.innerHTML = '<div class="alert alert-info">Migrando datos a Supabase...</div>';

      // Activar Supabase
      window.enableSupabase();

      // Migrar datos a Supabase
      try {
        // Migrar equipos
        if (teams && teams.length > 0) {
          for (const team of teams) {
            const { error } = await getSupabaseClient()
              .from('teams')
              .insert([{
                id: team.id,
                name: team.name,
                code: team.code,
                created_by: team.createdBy || null
              }]);

            if (error && error.code !== '23505') { // Ignorar errores de duplicados
              console.error('Error al migrar equipo:', error);
            }
          }
        }

        // Migrar usuarios
        if (users && users.length > 0) {
          for (const user of users) {
            // Crear usuario en Auth
            const { data, error } = await getSupabaseClient().auth.signUp({
              email: user.email,
              password: user.password || 'TemporaryPassword123!', // Usar la contraseña existente o una temporal
              options: {
                data: {
                  username: user.username
                }
              }
            });

            if (!error) {
              // Crear perfil de usuario
              await getSupabaseClient()
                .from('users')
                .insert([{
                  id: data.user.id,
                  username: user.username,
                  email: user.email,
                  is_admin: user.isAdmin,
                  team_id: user.teamId,
                  team_name: user.teamName,
                  team_code: user.teamCode
                }]);
            }
          }
        }

        // Migrar categorías
        if (categories && categories.length > 0) {
          for (const category of categories) {
            await getSupabaseClient()
              .from('categories')
              .insert([category]);
          }
        }

        // Migrar transacciones
        if (transactions && transactions.length > 0) {
          for (const transaction of transactions) {
            await getSupabaseClient()
              .from('transactions')
              .insert([{
                id: transaction.id,
                user_id: transaction.userId,
                type: transaction.type,
                cost_type: transaction.costType,
                amount: transaction.amount,
                category: transaction.category,
                date: transaction.date,
                description: transaction.description
              }]);
          }
        }

        // Migrar ahorros
        if (savings && savings.length > 0) {
          for (const saving of savings) {
            await getSupabaseClient()
              .from('savings')
              .insert([{
                id: uuidv4(),
                user_id: saving.userId,
                balance: saving.balance
              }]);

            // Migrar historial de ahorros si existe
            if (saving.history && saving.history.length > 0) {
              for (const historyItem of saving.history) {
                await getSupabaseClient()
                  .from('savings_history')
                  .insert([{
                    id: uuidv4(),
                    savings_id: saving.id,
                    user_id: saving.userId,
                    date: historyItem.date,
                    type: historyItem.type,
                    description: historyItem.description,
                    amount: historyItem.amount,
                    balance: historyItem.balance
                  }]);
              }
            }
          }
        }
      } catch (migrationError) {
        console.error('Error durante la migración:', migrationError);
        statusDiv.innerHTML = `<div class="alert alert-danger">Error durante la migración: ${migrationError.message}</div>`;
        startMigrationBtn.disabled = false;
        startMigrationBtn.textContent = 'Reintentar';
        return;
      }

      // Detener la simulación de progreso
      clearInterval(progressInterval);
      progressBarInner.style.width = '100%';

      // Mostrar mensaje de éxito
      statusDiv.innerHTML = '<div class="alert alert-success">Migración completada con éxito. Ahora puede acceder a sus datos desde cualquier dispositivo.</div>';

      // Cambiar el botón para recargar la página
      startMigrationBtn.textContent = 'Recargar Aplicación';
      startMigrationBtn.disabled = false;
      startMigrationBtn.addEventListener('click', () => {
        window.location.reload();
      });
    } catch (error) {
      console.error('Error al activar Supabase:', error);
      statusDiv.innerHTML = `<div class="alert alert-danger">Error inesperado: ${error.message}</div>`;
      startMigrationBtn.disabled = false;
      startMigrationBtn.textContent = 'Reintentar';
    }
  });
}

// Función para agregar un botón de migración en la sección de configuración
function addMigrationButton() {
  // Buscar la sección de configuración
  const settingsSection = document.getElementById('settings');
  if (!settingsSection) return;

  // Crear el contenedor para el botón de migración
  const migrationContainer = document.createElement('div');
  migrationContainer.className = 'col-md-12 mt-4';
  migrationContainer.innerHTML = `
    <div class="card dashboard-card">
      <div class="card-body">
        <h5 class="card-title">Sincronización con la Nube</h5>
        <p class="card-text">Sincronice sus datos con Supabase para acceder a ellos desde cualquier dispositivo y mejorar la seguridad.</p>
        <button id="syncDataBtn" class="btn btn-primary">Sincronizar con Supabase</button>
      </div>
    </div>
  `;

  // Agregar el contenedor a la sección de configuración
  settingsSection.querySelector('.row').appendChild(migrationContainer);

  // Configurar el botón para sincronizar datos con Supabase
  const syncDataBtn = document.getElementById('syncDataBtn');
  syncDataBtn.addEventListener('click', () => {
    if (typeof window.syncDataWithSupabase === 'function') {
      window.syncDataWithSupabase();
    } else {
      showNotification('Error', 'La función de sincronización no está disponible', 'error');
    }
  });
}

// Función para agregar un botón de activación de Supabase en la página de inicio de sesión
function addSupabaseActivationButton() {
  // Buscar la sección de inicio de sesión
  const loginSection = document.getElementById('loginSection');
  if (!loginSection) return;

  // Crear el contenedor para el botón de activación
  const activationContainer = document.createElement('div');
  activationContainer.className = 'text-center mt-3';
  activationContainer.innerHTML = `
    <button id="activateSupabaseBtn" class="btn btn-sm btn-outline-primary">Activar Supabase</button>
  `;

  // Agregar el contenedor a la sección de inicio de sesión
  loginSection.appendChild(activationContainer);

  // Configurar el botón para activar Supabase
  const activateSupabaseBtn = document.getElementById('activateSupabaseBtn');
  activateSupabaseBtn.addEventListener('click', () => {
    // Activar Supabase usando la función global
    window.enableSupabase();

    // Mostrar mensaje de éxito
    alert('Supabase activado correctamente. Ahora puede registrar usuarios en Supabase.');

    // Recargar la página
    window.location.reload();
  });
}

// Exponer las funciones globalmente
window.migrationUI = {
  showMigrationUI,
  addMigrationButton,
  addSupabaseActivationButton
};
