// Inicialización de la aplicación (versión no modular)

// Función para inicializar la aplicación
async function initializeApp() {
  try {
    console.log('Inicializando aplicación...');

    // Inicializar IndexedDB
    await openDatabase();

    // Verificar si se debe usar Supabase
    const useSupabase = isUsingSupabase();
    console.log('Usando Supabase:', useSupabase);

    if (useSupabase) {
      console.log('Usando Supabase como base de datos');

      // Verificar si hay una sesión activa
      const { data: { session } } = await getSupabaseClient().auth.getSession();

      if (session) {
        // Hay una sesión activa, cargar los datos del usuario
        const { data: { user } } = await getSupabaseClient().auth.getUser();

        if (user) {
          // Obtener el perfil del usuario
          const { data: profile, error } = await getSupabaseClient()
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error al obtener el perfil del usuario:', error);
            return false;
          }

          // Guardar el ID del usuario en sessionStorage para mantener compatibilidad
          sessionStorage.setItem('userId', user.id);
          sessionStorage.setItem('isAdmin', profile.is_admin);

          // Mostrar la interfaz principal
          document.getElementById('loginSection').style.display = 'none';
          document.querySelector('.navbar').style.display = 'flex';
          document.getElementById('content').style.display = 'block';

          // Cargar los datos del usuario
          await loadUserData(user.id);

          return true;
        }
      }

      // No hay sesión activa, mostrar la pantalla de inicio de sesión
      document.getElementById('loginSection').style.display = 'block';
      document.querySelector('.navbar').style.display = 'none';
      document.getElementById('content').style.display = 'none';
    } else {
      console.log('Usando IndexedDB como base de datos');

      // Cargar datos de IndexedDB
      await loadDataFromIndexedDB();

      // Agregar el botón de migración a la sección de configuración
      setTimeout(() => {
        if (window.migrationUI && typeof window.migrationUI.addMigrationButton === 'function') {
          window.migrationUI.addMigrationButton();
        }
      }, 1000);
    }

    // Inicializar la interfaz de usuario
    initializeUI();

    console.log('Aplicación inicializada correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar la aplicación:', error);
    return false;
  }
}

// Función para cargar datos de IndexedDB
async function loadDataFromIndexedDB() {
  try {
    // Obtener el ID de usuario de la sesión
    const userId = sessionStorage.getItem('userId');
    if (!userId) return;

    // Cargar transacciones
    const allTransactions = await getAllFromDb('transactions');
    window.transactions = allTransactions.filter(t => t.userId === userId);

    // Cargar categorías
    const allCategories = await getAllFromDb('categories');
    window.categories = allCategories;

    // Cargar ahorros
    const allSavings = await getAllFromDb('savings');
    const userSavings = allSavings.find(s => s.userId === userId);

    if (userSavings) {
      window.savingsBalance = userSavings.balance;
      window.savingsHistory = userSavings.history;
    } else {
      window.savingsBalance = 0;
      window.savingsHistory = [];
    }
  } catch (error) {
    console.error('Error al cargar datos de IndexedDB:', error);
  }
}

// Función para inicializar la interfaz de usuario
function initializeUI() {
  try {
    // Verificar si las funciones necesarias están disponibles
    if (typeof updateDashboard === 'function') {
      updateDashboard();
    }

    if (typeof updateHistoryList === 'function') {
      updateHistoryList();
    }

    if (typeof updateCategoryList === 'function') {
      updateCategoryList();
    }

    if (typeof calculateKPIs === 'function') {
      calculateKPIs();
    }

    // Inicializar la interfaz de sincronización
    if (typeof initSyncUI === 'function') {
      initSyncUI();
    }

    // Inicializar la sincronización en tiempo real si se está usando Supabase
    if (isUsingSupabase()) {
      if (typeof initRealtimeSync === 'function') {
        initRealtimeSync();
      }
    }

    // Mostrar el estado de la base de datos
    if (typeof showDatabaseStatus === 'function') {
      showDatabaseStatus();
    }

    console.log('Interfaz de usuario inicializada correctamente');
  } catch (error) {
    console.error('Error al inicializar la interfaz de usuario:', error);
  }
}

// Inicializar la aplicación cuando se cargue la página
document.addEventListener('DOMContentLoaded', () => {
  // Inicializar Supabase primero
  initSupabase().then(() => {
    // Luego inicializar la aplicación
    initializeApp();
  });
});
