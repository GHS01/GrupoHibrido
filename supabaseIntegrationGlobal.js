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

  // Función para agregar una transacción
  window.supabaseIntegration.addTransaction = async function(transaction) {
    try {
      console.log('Agregando transacción desde supabaseIntegrationGlobal:', transaction);

      // Verificar si se está usando Supabase
      if (!window.supabaseIntegration.isUsingSupabase()) {
        // Usar la función original de IndexedDB
        return await window.addToDb('transactions', transaction);
      }

      // Asegurarse de que la transacción tenga el ID de usuario
      if (!transaction.user_id && !transaction.userId) {
        const userId = sessionStorage.getItem('userId');
        transaction.userId = userId;
        transaction.user_id = userId;
      }

      // Intentar usar la función de supabaseService
      let result;
      if (typeof window.supabaseService !== 'undefined' && typeof window.supabaseService.addTransaction === 'function') {
        result = await window.supabaseService.addTransaction(transaction);
      } else {
        // Fallback a la función de supabaseServiceNonModule
        result = await window.addTransaction(transaction);
      }

      // Actualizar la variable global window.transactions para reflejar el cambio inmediatamente
      if (!window.transactions) window.transactions = [];

      // Verificar si la transacción ya existe en window.transactions para evitar duplicados
      const existingIndex = window.transactions.findIndex(t => t.id === transaction.id);
      if (existingIndex === -1) {
        // Solo agregar si no existe
        window.transactions.push(transaction);
        console.log('Transacción agregada a window.transactions. Total:', window.transactions.length);
      } else {
        console.log('La transacción ya existe en window.transactions, no se agrega duplicado');
      }

      // Actualizar el saldo de ahorros inmediatamente
      try {
        // Obtener el saldo actualizado desde Supabase
        const { data: savingsData, error: savingsError } = await window.getSupabaseClient()
          .from('savings')
          .select('balance')
          .eq('user_id', transaction.user_id || transaction.userId)
          .single();

        if (!savingsError && savingsData) {
          // Actualizar la variable global window.savingsBalance
          window.savingsBalance = savingsData.balance;
          console.log('Saldo de ahorros actualizado inmediatamente:', window.savingsBalance);
        } else {
          console.error('Error al obtener saldo actualizado:', savingsError);
        }
      } catch (savingsError) {
        console.error('Error al actualizar saldo de ahorros:', savingsError);
      }

      // Actualizar el historial de ahorros inmediatamente
      try {
        // Obtener el historial de ahorros actualizado desde Supabase
        const { data: savingsHistoryData, error: historyError } = await window.getSupabaseClient()
          .from('savings_history')
          .select('*')
          .eq('user_id', transaction.user_id || transaction.userId)
          .order('created_at', { ascending: false });

        if (!historyError && savingsHistoryData) {
          // Actualizar la variable global window.savingsHistory
          window.savingsHistory = savingsHistoryData.map(h => ({
            id: h.id,
            userId: h.user_id,
            user_id: h.user_id,
            date: h.date,
            type: h.type,
            amount: h.amount,
            balance: h.balance,
            description: h.description,
            created_at: h.created_at
          }));
          console.log('Historial de ahorros actualizado inmediatamente:', window.savingsHistory.length);
        } else {
          console.error('Error al obtener historial de ahorros actualizado:', historyError);
        }
      } catch (historyError) {
        console.error('Error al actualizar historial de ahorros:', historyError);
      }

      // Actualizar inmediatamente todas las vistas
      console.log('Actualizando vistas después de guardar transacción...');
      if (typeof window.updateDashboard === 'function') window.updateDashboard();
      if (typeof window.updateHistoryList === 'function') window.updateHistoryList();
      if (typeof window.updateSavingsDisplay === 'function') window.updateSavingsDisplay();

      return result;
    } catch (error) {
      console.error('Error en addTransaction global:', error);
      window.showNotification('Error', error.message || 'Ocurrió un error al agregar la transacción', 'error');
      throw error;
    }
  };

  // Función para eliminar una transacción
  window.supabaseIntegration.deleteTransaction = async function(id) {
    try {
      console.log('Eliminando transacción desde supabaseIntegrationGlobal:', id);

      // Guardar una copia de la transacción antes de eliminarla
      const transactionToDelete = window.transactions ? window.transactions.find(t => t.id === id) : null;
      const userId = transactionToDelete ? (transactionToDelete.user_id || transactionToDelete.userId) : sessionStorage.getItem('userId');

      // Verificar si se está usando Supabase
      if (!window.supabaseIntegration.isUsingSupabase()) {
        // Usar la función original de IndexedDB
        return await window.deleteFromDb('transactions', id);
      }

      // Intentar usar la función de supabaseService
      let result;
      if (typeof window.supabaseService !== 'undefined' && typeof window.supabaseService.deleteTransaction === 'function') {
        result = await window.supabaseService.deleteTransaction(id);
      } else {
        // Fallback a la función de supabaseServiceNonModule
        result = await window.deleteTransaction(id);
      }

      // Actualizar la lista local de transacciones inmediatamente
      if (window.transactions) {
        console.log('Actualizando lista local de transacciones...');
        window.transactions = window.transactions.filter(t => t.id !== id);
      }

      // Actualizar el saldo de ahorros inmediatamente
      try {
        // Obtener el saldo actualizado desde Supabase
        const { data: savingsData, error: savingsError } = await window.getSupabaseClient()
          .from('savings')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (!savingsError && savingsData) {
          // Actualizar la variable global window.savingsBalance
          window.savingsBalance = savingsData.balance;
          console.log('Saldo de ahorros actualizado inmediatamente después de eliminar:', window.savingsBalance);
        } else {
          console.error('Error al obtener saldo actualizado después de eliminar:', savingsError);
        }
      } catch (savingsError) {
        console.error('Error al actualizar saldo de ahorros después de eliminar:', savingsError);
      }

      // Actualizar el historial de ahorros inmediatamente
      try {
        // Obtener el historial de ahorros actualizado desde Supabase
        const { data: savingsHistoryData, error: historyError } = await window.getSupabaseClient()
          .from('savings_history')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!historyError && savingsHistoryData) {
          // Actualizar la variable global window.savingsHistory
          window.savingsHistory = savingsHistoryData.map(h => ({
            id: h.id,
            userId: h.user_id,
            user_id: h.user_id,
            date: h.date,
            type: h.type,
            amount: h.amount,
            balance: h.balance,
            description: h.description,
            created_at: h.created_at
          }));
          console.log('Historial de ahorros actualizado inmediatamente después de eliminar:', window.savingsHistory.length);
        } else {
          console.error('Error al obtener historial de ahorros actualizado después de eliminar:', historyError);
        }
      } catch (historyError) {
        console.error('Error al actualizar historial de ahorros después de eliminar:', historyError);
      }

      // Actualizar la interfaz inmediatamente
      console.log('Actualizando vistas después de eliminar transacción...');
      if (typeof window.updateDashboard === 'function') window.updateDashboard();
      if (typeof window.updateHistoryList === 'function') window.updateHistoryList();
      if (typeof window.updateSavingsDisplay === 'function') window.updateSavingsDisplay();

      return result;
    } catch (error) {
      console.error('Error en deleteTransaction global:', error);
      window.showNotification('Error', error.message || 'Ocurrió un error al eliminar la transacción', 'error');
      throw error;
    }
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
