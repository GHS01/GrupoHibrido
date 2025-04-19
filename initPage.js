// Script de inicialización para la página

// Función para inicializar la página
async function initPage() {
  try {
    console.log('Inicializando página...');

    // Inicializar Supabase
    await initSupabase();

    // Verificar si hay una sesión activa
    const { data: { session } } = await getSupabaseClient().auth.getSession();

    if (session) {
      console.log('Sesión activa encontrada');

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();

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
        } else {
          console.log('Perfil de usuario:', profile);

          // Guardar el ID del usuario en sessionStorage
          sessionStorage.setItem('userId', user.id);
          sessionStorage.setItem('isAdmin', profile.is_admin);

          // Mostrar la interfaz principal
          document.getElementById('loginSection').style.display = 'none';
          document.querySelector('.navbar').style.display = 'flex';
          document.getElementById('content').style.display = 'block';

          // Actualizar la interfaz con los datos del usuario
          document.getElementById('profileUsername').textContent = profile.username;
          const adminBadge = profile.is_admin ? '<span class="admin-badge"><span class="text">Administrador</span><span class="icon">🎖️</span></span>' : '<span class="admin-badge">Usuario Normal</span>';
          document.getElementById('profileUsername').innerHTML += ` ${adminBadge}`;

          // Mostrar información del equipo de trabajo
          const teamInfoElements = document.querySelectorAll('.team-info');
          const teamCodeSection = document.getElementById('teamCodeSection');

          console.log('Datos del equipo en perfil:', {
            team_id: profile.team_id,
            team_name: profile.team_name,
            team_code: profile.team_code
          });

          if (profile.team_id && profile.team_name) {
            console.log('Actualizando elementos de equipo con:', profile.team_name);
            teamInfoElements.forEach(element => {
              element.textContent = profile.team_name;
            });

            if (profile.team_code) {
              updateTeamCodeDisplay(profile.team_code);

              if (teamCodeSection) {
                teamCodeSection.style.display = profile.is_admin ? 'block' : 'none';
              }
            }
          } else {
            // Intentar obtener información del equipo desde los metadatos del usuario
            const { data: { user } } = await getSupabaseClient().auth.getUser();
            const metadata = user?.user_metadata || {};

            if (metadata.team_id && metadata.team_name) {
              console.log('Usando información de equipo desde metadatos:', metadata.team_name);

              // Actualizar el perfil con la información del equipo
              try {
                const { data, error } = await getSupabaseClient()
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
              teamInfoElements.forEach(element => {
                element.textContent = metadata.team_name;
              });

              if (metadata.team_code) {
                updateTeamCodeDisplay(metadata.team_code);

                if (teamCodeSection) {
                  teamCodeSection.style.display = profile.is_admin ? 'block' : 'none';
                }
              }
            } else {
              console.log('No se encontró información del equipo');
              teamInfoElements.forEach(element => {
                element.textContent = "No asignado";
              });

              if (teamCodeSection) {
                teamCodeSection.style.display = 'none';
              }
            }
          }

          // Actualizar la interfaz de administrador
          const isAdmin = profile.is_admin;
          const adminSection = document.getElementById('adminSection');

          if (adminSection) {
            adminSection.style.display = isAdmin ? 'block' : 'none';
          }

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

      // Mostrar la pantalla de inicio de sesión
      document.getElementById('loginSection').style.display = 'block';
      document.querySelector('.navbar').style.display = 'none';
      document.getElementById('content').style.display = 'none';
    }

    console.log('Página inicializada correctamente');
  } catch (error) {
    console.error('Error al inicializar la página:', error);
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

// Función para cargar los datos del usuario
async function loadUserData(userId) {
  try {
    // Cargar transacciones
    console.log('Cargando transacciones para el usuario:', userId);
    const { data: transactions, error: transactionsError } = await getSupabaseClient()
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (transactionsError) {
      console.error('Error al cargar transacciones:', transactionsError);
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

// Inicializar la página cuando se cargue el documento
document.addEventListener('DOMContentLoaded', async () => {
  // Agregar el botón de activación de Supabase
  if (window.migrationUI && typeof window.migrationUI.addSupabaseActivationButton === 'function') {
    window.migrationUI.addSupabaseActivationButton();
  }

  // Inicializar la página
  await initPage();
});
