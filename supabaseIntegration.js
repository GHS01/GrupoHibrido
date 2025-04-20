// Integración de Supabase en la aplicación
import { supabase } from './supabaseClient.js';
import * as supabaseService from './supabaseService.js';
import { addMigrationButton } from './migrationUI.js';
import { initRealtimeSync, startPeriodicRefresh, refreshData } from './realtimeSync.js';

// Variable para controlar si se usa Supabase o IndexedDB
let useSupabase = false;

// Función para inicializar la integración con Supabase
export async function initSupabaseIntegration() {
  try {
    // Verificar si el usuario ha migrado a Supabase
    const hasMigrated = localStorage.getItem('useSupabase') === 'true';

    if (hasMigrated) {
      useSupabase = true;
      console.log('Usando Supabase como base de datos');

      // Verificar si hay una sesión activa
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Hay una sesión activa, cargar los datos del usuario
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Obtener el perfil del usuario
          const { data: profile, error } = await supabase
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

          // Inicializar sincronización en tiempo real
          await initRealtimeSync();

          // Iniciar recarga periódica como respaldo
          startPeriodicRefresh(15000); // Cada 15 segundos

          return true;
        }
      }

      // No hay sesión activa, mostrar la pantalla de inicio de sesión
      document.getElementById('loginSection').style.display = 'block';
      document.querySelector('.navbar').style.display = 'none';
      document.getElementById('content').style.display = 'none';

      return false;
    } else {
      // No ha migrado, usar IndexedDB y mostrar el botón de migración
      useSupabase = false;
      console.log('Usando IndexedDB como base de datos');

      // Agregar el botón de migración a la sección de configuración
      setTimeout(() => {
        addMigrationButton();
      }, 1000);

      return false;
    }
  } catch (error) {
    console.error('Error al inicializar la integración con Supabase:', error);
    return false;
  }
}

// Función para verificar si se está usando Supabase
export function isUsingSupabase() {
  return useSupabase || localStorage.getItem('useSupabase') === 'true';
}

// Función para activar el uso de Supabase
export function enableSupabase() {
  useSupabase = true;
  localStorage.setItem('useSupabase', 'true');
}

// Función para desactivar el uso de Supabase
export function disableSupabase() {
  useSupabase = false;
  localStorage.removeItem('useSupabase');
}

// Funciones de autenticación
export async function registerUser(username, email, password, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  if (useSupabase) {
    return await supabaseService.signUp(email, password, username, isAdmin, teamId, teamName, teamCode);
  } else {
    // Usar la función original de IndexedDB
    return await window.registerUser(username, password);
  }
}

export async function loginUser(email, password) {
  if (useSupabase) {
    const result = await supabaseService.signIn(email, password);

    if (result.user) {
      // Guardar el ID del usuario en sessionStorage para mantener compatibilidad
      sessionStorage.setItem('userId', result.user.id);
      sessionStorage.setItem('isAdmin', result.profile.is_admin);

      // Mostrar la interfaz principal
      document.getElementById('loginSection').style.display = 'none';
      document.querySelector('.navbar').style.display = 'flex';
      document.getElementById('content').style.display = 'block';

      // Cargar los datos del usuario
      await loadUserData(result.user.id);

      // Inicializar sincronización en tiempo real
      await initRealtimeSync();

      // Iniciar recarga periódica como respaldo
      startPeriodicRefresh(15000); // Cada 15 segundos

      return result;
    }

    return null;
  } else {
    // Usar la función original de IndexedDB
    return await window.loginUser(email, password);
  }
}

export async function logoutUser() {
  try {
    console.log('Cerrando sesión desde supabaseIntegration...');

    if (useSupabase) {
      // Limpiar suscripciones en tiempo real si existen
      if (typeof window.cleanupSubscriptions === 'function') {
        window.cleanupSubscriptions();
        console.log('Suscripciones en tiempo real limpiadas');
      }

      // Detener la recarga periódica si existe
      if (typeof window.stopPeriodicRefresh === 'function') {
        window.stopPeriodicRefresh();
        console.log('Recarga periódica detenida');
      }

      // Cerrar sesión en Supabase
      const result = await supabaseService.signOut();

      if (!result.success) {
        console.error('Error al cerrar sesión en Supabase:', result.error);
      }

      // Limpiar variables globales
      window.transactions = [];
      window.savingsBalance = 0;
      window.savingsHistory = [];
      window.categories = [];

      // Limpiar sessionStorage
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('isAdmin');

      // Mostrar la pantalla de inicio de sesión
      document.getElementById('loginSection').style.display = 'block';
      document.querySelector('.navbar').style.display = 'none';
      document.getElementById('content').style.display = 'none';

      console.log('Sesión cerrada correctamente');
      return { success: true };
    } else {
      // Usar la función original de IndexedDB
      return await window.logout();
    }
  } catch (error) {
    console.error('Error en logoutUser:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al cerrar sesión'
    };
  }
}

// Funciones CRUD para transacciones
export async function addTransaction(transaction) {
  if (useSupabase) {
    const result = await supabaseService.addTransaction(transaction);

    // Forzar una recarga de datos para asegurar la sincronización
    setTimeout(() => refreshData(), 500);

    return result;
  } else {
    // Usar la función original de IndexedDB
    return await window.addToDb('transactions', transaction);
  }
}

export async function updateTransaction(transaction) {
  if (useSupabase) {
    const result = await supabaseService.updateTransaction(transaction);

    // Forzar una recarga de datos para asegurar la sincronización
    setTimeout(() => refreshData(), 500);

    return result;
  } else {
    // Usar la función original de IndexedDB
    return await window.putToDb('transactions', transaction);
  }
}

export async function deleteTransaction(id) {
  if (useSupabase) {
    const result = await supabaseService.deleteTransaction(id);

    // Forzar una recarga de datos para asegurar la sincronización
    setTimeout(() => refreshData(), 500);

    return result;
  } else {
    // Usar la función original de IndexedDB
    return await window.deleteFromDb('transactions', id);
  }
}

export async function getUserTransactions() {
  if (useSupabase) {
    return await supabaseService.getUserTransactions();
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const allTransactions = await window.getAllFromDb('transactions');
    return allTransactions.filter(t => t.userId === userId);
  }
}

// Funciones CRUD para categorías
export async function addCategory(category) {
  if (useSupabase) {
    return await supabaseService.addCategory(category);
  } else {
    // Usar la función original de IndexedDB
    return await window.addToDb('categories', category);
  }
}

export async function updateCategory(category) {
  if (useSupabase) {
    return await supabaseService.updateCategory(category);
  } else {
    // Usar la función original de IndexedDB
    return await window.putToDb('categories', category);
  }
}

export async function deleteCategory(name) {
  if (useSupabase) {
    return await supabaseService.deleteCategory(name);
  } else {
    // Usar la función original de IndexedDB
    return await window.deleteFromDb('categories', name);
  }
}

export async function getAllCategories() {
  if (useSupabase) {
    return await supabaseService.getAllCategories();
  } else {
    // Usar la función original de IndexedDB
    return await window.getAllFromDb('categories');
  }
}

// Funciones para ahorros
export async function getUserSavings() {
  if (useSupabase) {
    return await supabaseService.getUserSavings();
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const allSavings = await window.getAllFromDb('savings');
    return allSavings.find(s => s.userId === userId) || { balance: 0, history: [] };
  }
}

export async function updateSavingsBalance(balance) {
  if (useSupabase) {
    return await supabaseService.updateSavingsBalance(balance);
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const savingsEntry = {
      date: new Date().toISOString().split('T')[0],
      type: 'Saldo Inicial',
      description: 'Configuración de saldo inicial',
      amount: balance,
      balance: balance,
      userId: userId
    };

    const savingsData = {
      id: Date.now(),
      balance: balance,
      history: [savingsEntry],
      userId: userId
    };

    return await window.putToDb('savings', savingsData);
  }
}

export async function getSavingsHistory() {
  if (useSupabase) {
    return await supabaseService.getSavingsHistory();
  } else {
    // Usar la función original de IndexedDB
    const userId = sessionStorage.getItem('userId');
    const allSavings = await window.getAllFromDb('savings');
    const userSavings = allSavings.find(s => s.userId === userId);
    return userSavings ? userSavings.history : [];
  }
}

// Funciones para usuarios
export async function getAllUsers() {
  if (useSupabase) {
    return await supabaseService.getAllUsers();
  } else {
    // Usar la función original de IndexedDB
    return await window.getAllFromDb('users');
  }
}

// Función para cargar los datos del usuario
async function loadUserData(userId) {
  if (useSupabase) {
    // Obtener el perfil del usuario
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error al obtener el perfil del usuario:', error);
      return;
    }

    // Actualizar la interfaz con los datos del usuario
    document.getElementById('profileUsername').textContent = profile.username;
    const adminBadge = profile.is_admin ? '<span class="admin-badge"><span class="text">Administrador</span><span class="icon">🎖️</span></span>' : '<span class="admin-badge">Usuario Normal</span>';
    document.getElementById('profileUsername').innerHTML += ` ${adminBadge}`;

    // Mostrar información del equipo de trabajo
    const teamInfoElements = document.querySelectorAll('.team-info');
    const teamCodeSection = document.getElementById('teamCodeSection');

    console.log('Datos del equipo en perfil (supabaseIntegration):', {
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
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const metadata = user?.user_metadata || {};

        if (metadata.team_id && metadata.team_name) {
          console.log('Usando información de equipo desde metadatos:', metadata.team_name);

          // Actualizar el perfil con la información del equipo
          try {
            const { data, error } = await supabase
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
      } catch (metadataError) {
        console.error('Error al obtener metadatos del usuario:', metadataError);
        teamInfoElements.forEach(element => {
          element.textContent = "No asignado";
        });

        if (teamCodeSection) {
          teamCodeSection.style.display = 'none';
        }
      }
    }

    // Actualizar la interfaz de administrador
    updateAdminInterface();

    // Cargar transacciones, categorías y ahorros
    await loadTransactions();
    await loadCategories();
    await loadSavings();

    // Actualizar el dashboard
    updateDashboard();
  } else {
    // Usar la función original de IndexedDB
    return await window.loadUserData(userId);
  }
}

// Función para cargar las transacciones
async function loadTransactions() {
  if (useSupabase) {
    const transactions = await supabaseService.getUserTransactions();
    window.transactions = transactions;
  }
}

// Función para cargar las categorías
async function loadCategories() {
  if (useSupabase) {
    const categories = await supabaseService.getAllCategories();
    window.categories = categories;
  }
}

// Función para cargar los ahorros
async function loadSavings() {
  if (useSupabase) {
    const savings = await supabaseService.getUserSavings();
    window.savingsBalance = savings.balance;

    const history = await supabaseService.getSavingsHistory();
    window.savingsHistory = history;
  }
}

// Función para cargar el perfil de otro usuario
export async function loadUserProfile(userId) {
  try {
    console.log('Cargando perfil de usuario:', userId);

    if (useSupabase) {
      // Verificar que el usuario pertenezca al mismo equipo
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener el perfil del usuario actual
      const { data: currentUserProfile, error: currentUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (currentUserError) {
        console.error('Error al obtener perfil del usuario actual:', currentUserError);
        throw new Error('No se pudo obtener el perfil del usuario actual');
      }

      // Obtener el perfil del usuario objetivo
      const { data: targetUserProfile, error: targetUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (targetUserError) {
        console.error('Error al obtener perfil del usuario objetivo:', targetUserError);
        throw new Error('Usuario no encontrado');
      }

      // Verificar que ambos usuarios pertenezcan al mismo equipo
      if (targetUserProfile.team_id !== currentUserProfile.team_id) {
        throw new Error('Solo puede cargar perfiles de usuarios de su mismo equipo');
      }

      // Guardar el ID del usuario objetivo para usarlo en las funciones de filtrado
      // Esto es crucial para que las funciones de filtrado usen el ID correcto
      const targetUserId = targetUserProfile.id;
      console.log('ID del usuario objetivo guardado para filtrado:', targetUserId);

      const confirmed = await window.showConfirmDialog({
        title: 'Confirmar Carga de Perfil',
        message: '¿Está seguro de cargar este perfil de usuario? Esto reemplazará sus datos actuales.',
        icon: '📊',
        confirmText: 'Cargar Perfil'
      });

      if (!confirmed) return;

      // Reiniciar datos actuales
      window.transactions = [];
      window.savingsBalance = 0;
      window.savingsHistory = [];

      // 1. Cargar transacciones del usuario objetivo
      const { data: targetTransactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);

      if (transactionsError) {
        console.error('Error al cargar transacciones del usuario objetivo:', transactionsError);
        throw new Error('No se pudieron cargar las transacciones');
      }

      // Clonar las transacciones para el usuario actual
      for (const transaction of targetTransactions) {
        if (transaction.type !== 'tir_project') {
          const newTransaction = {
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            date: transaction.date,
            description: transaction.description,
            cost_type: transaction.cost_type || '',
            user_id: user.id
          };

          const { data, error } = await supabase
            .from('transactions')
            .insert([newTransaction]);

          if (error) {
            console.error('Error al clonar transacción:', error);
          }
        }
      }

      // 2. Cargar ahorros del usuario objetivo
      const { data: targetSavings, error: savingsError } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (savingsError && savingsError.code !== 'PGRST116') { // Ignorar error si no hay registros
        console.error('Error al cargar ahorros del usuario objetivo:', savingsError);
        throw new Error('No se pudieron cargar los ahorros');
      }

      // 3. Cargar historial de ahorros del usuario objetivo
      const { data: targetSavingsHistory, error: historyError } = await supabase
        .from('savings_history')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });

      if (historyError) {
        console.error('Error al cargar historial de ahorros del usuario objetivo:', historyError);
        throw new Error('No se pudo cargar el historial de ahorros');
      }

      // Actualizar los ahorros del usuario actual
      if (targetSavings) {
        // Eliminar registros existentes de ahorros
        const { error: deleteError } = await supabase
          .from('savings')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error al eliminar ahorros existentes:', deleteError);
        }

        // Crear nuevo registro de ahorros
        const { error: insertError } = await supabase
          .from('savings')
          .insert([{
            balance: targetSavings.balance,
            user_id: user.id
          }]);

        if (insertError) {
          console.error('Error al insertar nuevos ahorros:', insertError);
        }

        window.savingsBalance = targetSavings.balance;
      }

      // Actualizar el historial de ahorros del usuario actual
      if (targetSavingsHistory && targetSavingsHistory.length > 0) {
        // Eliminar registros existentes del historial
        const { error: deleteHistoryError } = await supabase
          .from('savings_history')
          .delete()
          .eq('user_id', user.id);

        if (deleteHistoryError) {
          console.error('Error al eliminar historial existente:', deleteHistoryError);
        }

        // Crear nuevos registros de historial
        const newHistoryEntries = targetSavingsHistory.map(entry => ({
          date: entry.date,
          type: entry.type,
          amount: entry.amount,
          balance: entry.balance,
          description: entry.description,
          user_id: user.id
        }));

        for (const entry of newHistoryEntries) {
          const { error: insertHistoryError } = await supabase
            .from('savings_history')
            .insert([entry]);

          if (insertHistoryError) {
            console.error('Error al insertar entrada de historial:', insertHistoryError);
          }
        }

        window.savingsHistory = newHistoryEntries;
      }

      // Cargar las transacciones actualizadas - IMPORTANTE: Usar targetUserId para cargar los datos del usuario objetivo
      const { data: updatedTransactions, error: updatedTransactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', targetUserId); // Usar el ID del usuario objetivo

      if (updatedTransactionsError) {
        console.error('Error al cargar transacciones actualizadas:', updatedTransactionsError);
        // Establecer un valor predeterminado para evitar errores
        window.transactions = [];
      } else {
        // Convertir de snake_case a camelCase para mantener compatibilidad
        window.transactions = updatedTransactions.map(t => ({
          id: t.id,
          userId: targetUserId, // Usar el ID del usuario objetivo
          user_id: targetUserId, // Usar el ID del usuario objetivo
          type: t.type,
          costType: t.cost_type,
          cost_type: t.cost_type,
          amount: t.amount,
          category: t.category,
          date: t.date,
          description: t.description
        }));

        console.log('Transacciones actualizadas cargadas:', window.transactions.length);
        console.log('Muestra de transacciones:', window.transactions.slice(0, 2));
      }

      // Cargar los ahorros actualizados - IMPORTANTE: Usar targetUserId para cargar los datos del usuario objetivo
      const { data: updatedSavings, error: updatedSavingsError } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', targetUserId) // Usar el ID del usuario objetivo
        .single();

      if (updatedSavingsError && updatedSavingsError.code !== 'PGRST116') {
        console.error('Error al cargar ahorros actualizados:', updatedSavingsError);
        // Establecer un valor predeterminado para evitar errores
        window.savingsBalance = 0;
      } else if (updatedSavings) {
        window.savingsBalance = updatedSavings.balance;
        console.log('Balance de ahorros actualizado:', window.savingsBalance);
      } else {
        // Si no hay ahorros, establecer un valor predeterminado
        window.savingsBalance = 0;
        console.log('No se encontraron ahorros, estableciendo balance a 0');
      }

      // Cargar el historial de ahorros actualizado - IMPORTANTE: Usar targetUserId para cargar los datos del usuario objetivo
      const { data: updatedSavingsHistory, error: updatedHistoryError } = await supabase
        .from('savings_history')
        .select('*')
        .eq('user_id', targetUserId) // Usar el ID del usuario objetivo
        .order('date', { ascending: true });

      if (updatedHistoryError) {
        console.error('Error al cargar historial de ahorros actualizado:', updatedHistoryError);
        // Establecer un valor predeterminado para evitar errores
        window.savingsHistory = [];
      } else {
        // Convertir de snake_case a camelCase para mantener compatibilidad
        window.savingsHistory = updatedSavingsHistory.map(h => ({
          id: h.id,
          userId: targetUserId, // Usar el ID del usuario objetivo
          user_id: targetUserId, // Usar el ID del usuario objetivo
          date: h.date,
          type: h.type,
          amount: h.amount,
          balance: h.balance,
          description: h.description
        }));

        console.log('Historial de ahorros actualizado cargado:', window.savingsHistory.length);
        console.log('Muestra de historial:', window.savingsHistory.slice(0, 2));
      }

      // Actualizar el ID de usuario en la sesión para que las funciones de filtrado funcionen correctamente
      // IMPORTANTE: Usar targetUserId para que las funciones de filtrado usen el ID correcto
      sessionStorage.setItem('userId', targetUserId);
      console.log('ID de usuario actualizado en la sesión:', targetUserId);

      // Actualizar la interfaz
      window.updateDashboard();
      window.updateSavingsDisplay();
      window.calculateKPIs();
      window.updateHistoryList();
      window.updateCategoryList();
      window.generateReport('balanco');
      window.generateReport('dre');
      window.generateReport('fluxoCaixa');

      window.showNotification('¡Éxito!', 'Perfil cargado correctamente', 'success');
      return true;
    } else {
      // Usar la función original de IndexedDB
      return await window.loadUserProfile(userId);
    }
  } catch (error) {
    console.error('Error al cargar perfil de usuario:', error);
    window.showNotification('Error', error.message || 'Ocurrió un error al cargar el perfil', 'error');
    return false;
  }
}

// Función para actualizar la interfaz de administrador
function updateAdminInterface() {
  const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
  const adminSection = document.getElementById('adminSection');

  if (adminSection) {
    adminSection.style.display = isAdmin ? 'block' : 'none';
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

// Exponer las funciones globalmente
window.supabaseIntegration = {
  initSupabaseIntegration,
  isUsingSupabase,
  enableSupabase,
  disableSupabase,
  registerUser,
  loginUser,
  logoutUser,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getUserTransactions,
  addCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getUserSavings,
  updateSavingsBalance,
  getSavingsHistory,
  getAllUsers,
  loadUserProfile
};
