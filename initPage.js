// Script de inicialización para la página

// Función para inicializar la página
async function initPage() {
  try {
    console.log('Inicializando página...');

    // Inicializar variables globales para evitar errores
    window.transactions = window.transactions || [];
    window.savingsBalance = window.savingsBalance || 0;
    window.savingsHistory = window.savingsHistory || [];
    window.categories = window.categories || [];

    // Inicializar elementos del perfil de usuario con valores por defecto
    const profileUsername = document.getElementById('profileUsername');
    if (profileUsername) {
      profileUsername.textContent = 'Usuario';
    }

    const teamInfoElements = document.querySelectorAll('.team-info');
    teamInfoElements.forEach(element => {
      element.textContent = "No asignado";
    });

    const teamCodeSection = document.getElementById('teamCodeSection');
    if (teamCodeSection) {
      teamCodeSection.style.display = 'none';
    }

    // Inicializar Supabase con manejo de errores
    try {
      await initSupabase();
      console.log('Supabase inicializado correctamente');
    } catch (supabaseError) {
      console.error('Error al inicializar Supabase:', supabaseError);
      // Mostrar notificación al usuario si está disponible la función
      if (typeof showNotification === 'function') {
        showNotification('Advertencia', 'No se pudo conectar con la base de datos en la nube. Se usará el modo local.', 'warning');
      }
      // Forzar el uso de IndexedDB
      localStorage.setItem('useSupabase', 'false');
    }

    try {
      // Verificar si se está usando Supabase
      const useSupabase = localStorage.getItem('useSupabase') === 'true';

      if (!useSupabase) {
        console.log('Usando modo local (IndexedDB)');
        // Mostrar la pantalla de inicio de sesión para modo local
        document.getElementById('loginSection').style.display = 'block';
        document.querySelector('.navbar').style.display = 'none';
        document.getElementById('content').style.display = 'none';
        return;
      }

      // Verificar si hay una sesión activa
      let session = null;
      let sessionError = null;

      try {
        const sessionResponse = await getSupabaseClient().auth.getSession();
        session = sessionResponse.data.session;
        sessionError = sessionResponse.error;
      } catch (error) {
        console.error('Error al obtener la sesión:', error);
        sessionError = error;
      }

      if (sessionError) {
        console.error('Error al verificar la sesión:', sessionError);
        throw sessionError;
      }

      if (session) {
        console.log('Sesión activa encontrada');

        // Verificar si la sesión es válida (no ha expirado)
        const expiresAt = session.expires_at;
        const currentTime = Math.floor(Date.now() / 1000); // Tiempo actual en segundos

        if (expiresAt && expiresAt < currentTime) {
          console.log('La sesión ha expirado. Cerrando sesión...');
          await getSupabaseClient().auth.signOut();
          throw new Error('La sesión ha expirado');
        }

        // Obtener el usuario actual
        const { data: { user }, error: userError } = await getSupabaseClient().auth.getUser();

        if (userError) {
          console.error('Error al obtener el usuario:', userError);
          throw userError;
        }

        if (user) {
          console.log('Usuario autenticado:', user.email);

          // Obtener el perfil del usuario
          const { data: profile, error } = await getSupabaseClient()
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error al obtener el perfil del usuario:', error);
            throw error;
          } else {
            console.log('Perfil de usuario:', profile);

            // Guardar el ID del usuario en sessionStorage
            sessionStorage.setItem('userId', user.id);
            sessionStorage.setItem('isAdmin', profile.is_admin);

            // Mostrar la interfaz principal
            document.getElementById('loginSection').style.display = 'none';
            document.querySelector('.navbar').style.display = 'flex';
            document.getElementById('content').style.display = 'block';

            // Actualizar la interfaz con los datos del usuario usando la función centralizada
            updateProfileUI(profile);

            // Cargar datos del usuario
            await loadUserData(user.id);

            // Inicializar sincronización en tiempo real
            if (typeof initRealtimeSync === 'function') {
              await initRealtimeSync();
              console.log('Sincronización en tiempo real inicializada');
            }

            // Iniciar recarga periódica como respaldo
            if (typeof startPeriodicRefresh === 'function') {
              startPeriodicRefresh(15000); // Cada 15 segundos
              console.log('Recarga periódica iniciada');
            }
          }
        }
      } else {
        console.log('No hay sesión activa');
        // Limpiar cualquier dato de sesión que pudiera haber quedado
        sessionStorage.removeItem('userId');
        sessionStorage.removeItem('isAdmin');

        // Mostrar la pantalla de inicio de sesión
        document.getElementById('loginSection').style.display = 'block';
        document.querySelector('.navbar').style.display = 'none';
        document.getElementById('content').style.display = 'none';
      }
    } catch (error) {
      console.error('Error durante la verificación de sesión:', error);
      // Limpiar cualquier dato de sesión que pudiera haber quedado
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('isAdmin');

      // Mostrar la pantalla de inicio de sesión
      document.getElementById('loginSection').style.display = 'block';
      document.querySelector('.navbar').style.display = 'none';
      document.getElementById('content').style.display = 'none';
    }

    console.log('Página inicializada correctamente');
  } catch (error) {
    console.error('Error al inicializar la página:', error);

    // Mostrar mensaje de error al usuario
    if (typeof showNotification === 'function') {
      showNotification('Error', 'Ocurrió un error al inicializar la aplicación. Se usará el modo local.', 'error');
    }

    // Forzar el uso de IndexedDB en caso de error
    localStorage.setItem('useSupabase', 'false');

    // Mostrar la pantalla de inicio de sesión
    document.getElementById('loginSection').style.display = 'block';
    document.querySelector('.navbar').style.display = 'none';
    document.getElementById('content').style.display = 'none';
  }
}

// Función para actualizar la visualización del código de equipo
function updateTeamCodeDisplay(code) {
  const teamCodeDisplay = document.getElementById('teamCodeDisplay');
  const adminTeamCodeDisplay = document.getElementById('adminTeamCodeDisplay');

  if (teamCodeDisplay) {
    teamCodeDisplay.textContent = code;
  }

  if (adminTeamCodeDisplay) {
    adminTeamCodeDisplay.textContent = code;
  }
}

// Función para actualizar el nombre del equipo en la interfaz
function updateTeamNameDisplay(name) {
  const teamInfoElements = document.querySelectorAll('.team-info');
  teamInfoElements.forEach(element => {
    element.textContent = name;
  });
}

// Función para actualizar la interfaz de usuario con los datos del perfil
function updateProfileUI(profile) {
  try {
    console.log('Actualizando interfaz con perfil de usuario:', profile);

    // Actualizar el nombre de usuario en la interfaz
    const profileUsernameElement = document.getElementById('profileUsername');
    if (profileUsernameElement) {
      profileUsernameElement.textContent = profile.username || 'Usuario';

      // Añadir insignia de administrador si corresponde
      const adminBadge = profile.is_admin ? '<span class="admin-badge"><span class="text">Administrador</span><span class="icon">🏆️</span></span>' : '<span class="admin-badge">Usuario Normal</span>';
      profileUsernameElement.innerHTML += ` ${adminBadge}`;
    }

    // Actualizar información del equipo si está disponible
    if (profile.team_id && profile.team_name) {
      console.log('Datos del equipo en perfil:', {
        team_id: profile.team_id,
        team_name: profile.team_name,
        team_code: profile.team_code
      });

      // Actualizar el nombre del equipo en todos los elementos
      updateTeamNameDisplay(profile.team_name);

      // Actualizar el código del equipo si está disponible
      if (profile.team_code) {
        updateTeamCodeDisplay(profile.team_code);

        // Mostrar la sección de código de equipo si es administrador
        const teamCodeSection = document.getElementById('teamCodeSection');
        if (teamCodeSection) {
          teamCodeSection.style.display = profile.is_admin ? 'block' : 'none';
        }
      }
    } else {
      // Intentar obtener información del equipo desde los metadatos del usuario
      try {
        const { data: { user } } = getSupabaseClient().auth.getUser();
        const metadata = user?.user_metadata || {};

        if (metadata.team_id && metadata.team_name) {
          console.log('Usando información de equipo desde metadatos:', metadata.team_name);

          // Actualizar el perfil con la información del equipo
          try {
            const { data, error } = getSupabaseClient()
              .from('users')
              .update({
                team_id: metadata.team_id,
                team_name: metadata.team_name,
                team_code: metadata.team_code
              })
              .eq('id', profile.id);

            if (!error) {
              console.log('Perfil actualizado con información del equipo');
            }
          } catch (updateError) {
            console.error('Error al actualizar perfil con información del equipo:', updateError);
          }

          // Actualizar la interfaz
          updateTeamNameDisplay(metadata.team_name);

          if (metadata.team_code) {
            updateTeamCodeDisplay(metadata.team_code);

            const teamCodeSection = document.getElementById('teamCodeSection');
            if (teamCodeSection) {
              teamCodeSection.style.display = profile.is_admin ? 'block' : 'none';
            }
          }
        } else {
          // Si no hay información de equipo, mostrar "No asignado"
          const teamInfoElements = document.querySelectorAll('.team-info');
          teamInfoElements.forEach(element => {
            element.textContent = "No asignado";
          });

          // Ocultar la sección de código de equipo
          const teamCodeSection = document.getElementById('teamCodeSection');
          if (teamCodeSection) {
            teamCodeSection.style.display = 'none';
          }
        }
      } catch (metadataError) {
        console.error('Error al obtener metadatos del usuario:', metadataError);

        // Si hay error, mostrar "No asignado"
        const teamInfoElements = document.querySelectorAll('.team-info');
        teamInfoElements.forEach(element => {
          element.textContent = "No asignado";
        });

        // Ocultar la sección de código de equipo
        const teamCodeSection = document.getElementById('teamCodeSection');
        if (teamCodeSection) {
          teamCodeSection.style.display = 'none';
        }
      }
    }

    // Mostrar u ocultar la sección de administrador según corresponda
    const adminSection = document.getElementById('adminSection');
    if (adminSection) {
      adminSection.style.display = profile.is_admin ? 'block' : 'none';
    }

    // Si es administrador, cargar la lista de usuarios solo si no se ha cargado ya
    if (profile.is_admin) {
      if (typeof loadUsersList === 'function') {
        // Verificar si la variable usersListLoaded existe y es true
        if (typeof window.usersListLoaded === 'undefined' || window.usersListLoaded !== true) {
          console.log('Cargando lista de usuarios desde updateProfileUI');
          loadUsersList();
          // Marcar que ya se ha cargado la lista de usuarios
          window.usersListLoaded = true;
        } else {
          console.log('Lista de usuarios ya cargada, evitando duplicación desde updateProfileUI');
        }
      } else {
        console.warn('La función loadUsersList no está disponible');
      }
    }
  } catch (error) {
    console.error('Error al actualizar la interfaz de usuario con el perfil:', error);
  }
}

// Función para cargar los datos del usuario
async function loadUserData(userId) {
  try {
    // Guardar el ID del usuario en sessionStorage para que las funciones de filtrado lo usen
    sessionStorage.setItem('userId', userId);
    console.log('ID de usuario guardado en sessionStorage:', userId);

    // Cargar transacciones
    console.log('Cargando transacciones para el usuario:', userId);
    const { data: transactions, error: transactionsError } = await getSupabaseClient()
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (transactionsError) {
      console.error('Error al cargar transacciones:', transactionsError);
      // Asegurarse de que window.transactions sea un array incluso en caso de error
      window.transactions = [];
    } else {
      console.log('Transacciones cargadas:', transactions.length);

      // Mostrar las transacciones para depuración
      if (transactions && transactions.length > 0) {
        transactions.forEach((t, index) => {
          console.log(`Transacción ${index + 1} cargada:`, t);
        });
      }

      // Convertir de snake_case a camelCase para mantener compatibilidad
      window.transactions = transactions.map(t => ({
        id: t.id,
        userId: t.user_id,
        type: t.type,
        costType: t.cost_type,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description
      }));

      console.log('Variable global window.transactions inicializada con', window.transactions.length, 'transacciones');
    }

    // Cargar categorías
    const { data: categories, error: categoriesError } = await getSupabaseClient()
      .from('categories')
      .select('*');

    if (categoriesError) {
      console.error('Error al cargar categorías:', categoriesError);
    } else {
      console.log('Categorías cargadas:', categories.length);
      window.categories = categories;
    }

    // Cargar ahorros
    const { data: savingsData, error: savingsError } = await getSupabaseClient()
      .from('savings')
      .select('*')
      .eq('user_id', userId);

    if (savingsError) {
      console.error('Error al cargar ahorros:', savingsError);
      window.savingsBalance = 0;
    } else if (savingsData && savingsData.length > 0) {
      const savings = savingsData[0]; // Tomar el primer registro
      console.log('Ahorros cargados:', savings);
      window.savingsBalance = savings.balance;
    } else {
      console.log('No se encontraron ahorros para el usuario');
      window.savingsBalance = 0;
    }

    // Cargar historial de ahorros
    const { data: savingsHistory, error: historyError } = await getSupabaseClient()
      .from('savings_history')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (historyError) {
      console.error('Error al cargar historial de ahorros:', historyError);
      window.savingsHistory = [];
    } else {
      console.log('Historial de ahorros cargado:', savingsHistory.length);
      window.savingsHistory = savingsHistory;
    }

    // Actualizar el dashboard
    if (typeof window.updateDashboard === 'function') {
      console.log('Llamando a updateDashboard() desde initPage');
      window.updateDashboard();
    } else {
      console.warn('La función updateDashboard no está disponible en initPage');
    }

    // Actualizar la lista de historial
    if (typeof window.updateHistoryList === 'function') {
      console.log('Llamando a updateHistoryList() desde initPage');
      window.updateHistoryList();
    } else {
      console.warn('La función updateHistoryList no está disponible en initPage');
    }

    // Actualizar la visualización de ahorros
    if (typeof window.updateSavingsDisplay === 'function') {
      console.log('Llamando a updateSavingsDisplay() desde initPage');
      window.updateSavingsDisplay();
    } else {
      console.warn('La función updateSavingsDisplay no está disponible en initPage');
    }
  } catch (error) {
    console.error('Error al cargar datos del usuario:', error);
  }
}

// Función para mostrar notificación si no existe
if (typeof showNotification !== 'function') {
  window.showNotification = function(title, message, type) {
    console.log(`[${type.toUpperCase()}] ${title}: ${message}`);
    alert(`${title}: ${message}`);
  };
}

// Inicializar la página cuando se cargue el documento
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Agregar el botón de activación de Supabase
    if (window.migrationUI && typeof window.migrationUI.addSupabaseActivationButton === 'function') {
      window.migrationUI.addSupabaseActivationButton();
    }

    // Inicializar la página
    await initPage();
  } catch (error) {
    console.error('Error crítico al inicializar la aplicación:', error);

    // Mostrar mensaje de error al usuario
    if (typeof showNotification === 'function') {
      showNotification('Error', 'Ocurrió un error crítico al inicializar la aplicación. Intente recargar la página.', 'error');
    } else {
      alert('Error: Ocurrió un error crítico al inicializar la aplicación. Intente recargar la página.');
    }

    // Mostrar la pantalla de inicio de sesión
    document.getElementById('loginSection').style.display = 'block';
    document.querySelector('.navbar').style.display = 'none';
    document.getElementById('content').style.display = 'none';
  }
});
