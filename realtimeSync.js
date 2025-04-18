// Sincronización en tiempo real con Supabase
import { supabase } from './supabaseClient.js';

// Variable para almacenar las suscripciones activas
let activeSubscriptions = [];

// Función para inicializar las suscripciones en tiempo real
export async function initRealtimeSync() {
  try {
    console.log('Inicializando sincronización en tiempo real...');

    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No hay usuario autenticado para iniciar sincronización en tiempo real');
      return false;
    }

    // Limpiar suscripciones anteriores
    cleanupSubscriptions();

    // Suscribirse a cambios en la tabla de transacciones
    const transactionsSubscription = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => handleTransactionChange(payload)
      )
      .subscribe();

    // Suscribirse a cambios en la tabla de ahorros
    const savingsSubscription = supabase
      .channel('savings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => handleSavingsChange(payload)
      )
      .subscribe();

    // Suscribirse a cambios en el historial de ahorros
    const savingsHistorySubscription = supabase
      .channel('savings-history-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings_history',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => handleSavingsHistoryChange(payload)
      )
      .subscribe();

    // Guardar las suscripciones activas
    activeSubscriptions = [
      transactionsSubscription,
      savingsSubscription,
      savingsHistorySubscription
    ];

    console.log('Sincronización en tiempo real inicializada correctamente');
    return true;
  } catch (error) {
    console.error('Error al inicializar sincronización en tiempo real:', error);
    return false;
  }
}

// Función para limpiar las suscripciones activas
export function cleanupSubscriptions() {
  try {
    activeSubscriptions.forEach(subscription => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    });
    activeSubscriptions = [];
    console.log('Suscripciones limpiadas correctamente');
  } catch (error) {
    console.error('Error al limpiar suscripciones:', error);
  }
}

// Manejador de cambios en transacciones
function handleTransactionChange(payload) {
  console.log('Cambio detectado en transacciones:', payload);

  // Determinar el tipo de cambio
  const eventType = payload.eventType;
  const newRecord = payload.new;
  const oldRecord = payload.old;

  // Convertir de snake_case a camelCase
  const transaction = newRecord ? {
    id: newRecord.id,
    userId: newRecord.user_id,
    type: newRecord.type,
    costType: newRecord.cost_type,
    amount: newRecord.amount,
    category: newRecord.category,
    date: newRecord.date,
    description: newRecord.description
  } : null;

  // Actualizar los datos en memoria según el tipo de evento
  if (eventType === 'INSERT') {
    // Agregar la nueva transacción a la lista
    if (!window.transactions) window.transactions = [];
    window.transactions.push(transaction);
  } else if (eventType === 'UPDATE') {
    // Actualizar la transacción existente
    if (window.transactions) {
      const index = window.transactions.findIndex(t => t.id === transaction.id);
      if (index !== -1) {
        window.transactions[index] = transaction;
      }
    }
  } else if (eventType === 'DELETE') {
    // Eliminar la transacción
    if (window.transactions) {
      window.transactions = window.transactions.filter(t => t.id !== oldRecord.id);
    }
  }

  // Actualizar la interfaz de usuario
  if (typeof window.updateDashboard === 'function') {
    window.updateDashboard();
  }
  if (typeof window.updateHistoryList === 'function') {
    window.updateHistoryList();
  }
}

// Manejador de cambios en ahorros
function handleSavingsChange(payload) {
  console.log('Cambio detectado en ahorros:', payload);

  // Determinar el tipo de cambio
  const eventType = payload.eventType;
  const newRecord = payload.new;

  // Actualizar los datos en memoria según el tipo de evento
  if (eventType === 'UPDATE' || eventType === 'INSERT') {
    // Actualizar el saldo de ahorros
    window.savingsBalance = newRecord.balance;
  }

  // Actualizar la interfaz de usuario
  if (typeof window.updateSavingsDisplay === 'function') {
    window.updateSavingsDisplay();
  }
}

// Manejador de cambios en historial de ahorros
function handleSavingsHistoryChange(payload) {
  console.log('Cambio detectado en historial de ahorros:', payload);

  // Determinar el tipo de cambio
  const eventType = payload.eventType;
  const newRecord = payload.new;

  // Convertir de snake_case a camelCase
  const historyEntry = newRecord ? {
    id: newRecord.id,
    userId: newRecord.user_id,
    date: newRecord.date,
    type: newRecord.type,
    description: newRecord.description,
    amount: newRecord.amount,
    balance: newRecord.balance
  } : null;

  // Actualizar los datos en memoria según el tipo de evento
  if (eventType === 'INSERT') {
    // Agregar la nueva entrada al historial
    if (!window.savingsHistory) window.savingsHistory = [];
    window.savingsHistory.push(historyEntry);
  }

  // Actualizar la interfaz de usuario
  if (typeof window.updateSavingsDisplay === 'function') {
    window.updateSavingsDisplay();
  }
}

// Función para recargar manualmente los datos
export async function refreshData() {
  try {
    console.log('Recargando datos desde Supabase...');

    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No hay usuario autenticado para recargar datos');
      return false;
    }

    // Recargar transacciones
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (transactionsError) {
      console.error('Error al recargar transacciones:', transactionsError);
    } else {
      // Convertir de snake_case a camelCase
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
    }

    // Recargar ahorros
    const { data: savings, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (savingsError) {
      console.error('Error al recargar ahorros:', savingsError);
    } else if (savings) {
      window.savingsBalance = savings.balance;
    }

    // Recargar historial de ahorros
    const { data: history, error: historyError } = await supabase
      .from('savings_history')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (historyError) {
      console.error('Error al recargar historial de ahorros:', historyError);
    } else {
      // Convertir de snake_case a camelCase
      window.savingsHistory = history.map(h => ({
        id: h.id,
        userId: h.user_id,
        date: h.date,
        type: h.type,
        description: h.description,
        amount: h.amount,
        balance: h.balance
      }));
    }

    // Actualizar la interfaz de usuario
    if (typeof window.updateDashboard === 'function') {
      window.updateDashboard();
    }
    if (typeof window.updateHistoryList === 'function') {
      window.updateHistoryList();
    }
    if (typeof window.updateSavingsDisplay === 'function') {
      window.updateSavingsDisplay();
    }

    console.log('Datos recargados correctamente');
    return true;
  } catch (error) {
    console.error('Error al recargar datos:', error);
    return false;
  }
}

// Configurar recarga periódica de datos
let refreshInterval = null;

export function startPeriodicRefresh(intervalMs = 30000) {
  // Detener el intervalo anterior si existe
  stopPeriodicRefresh();

  // Iniciar un nuevo intervalo
  refreshInterval = setInterval(refreshData, intervalMs);
  console.log(`Recarga periódica iniciada cada ${intervalMs / 1000} segundos`);
}

export function stopPeriodicRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('Recarga periódica detenida');
  }
}

// Exponer funciones globalmente
window.initRealtimeSync = initRealtimeSync;
window.cleanupSubscriptions = cleanupSubscriptions;
window.refreshData = refreshData;
window.startPeriodicRefresh = startPeriodicRefresh;
window.stopPeriodicRefresh = stopPeriodicRefresh;
