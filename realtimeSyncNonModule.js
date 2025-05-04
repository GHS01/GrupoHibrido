// Sincronización en tiempo real con Supabase (versión no modular)

// Variable para almacenar las suscripciones activas
let activeSubscriptions = [];

// Función para inicializar las suscripciones en tiempo real
async function initRealtimeSync() {
  try {
    // Verificar si se está usando Supabase
    if (!isUsingSupabase()) {
      console.log('No se está usando Supabase, no se inicializará la sincronización en tiempo real');
      return false;
    }

    console.log('Inicializando sincronización en tiempo real...');

    // Obtener el cliente de Supabase
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Cliente de Supabase no disponible');
      return false;
    }

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
function cleanupSubscriptions() {
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
    user_id: newRecord.user_id, // Mantener ambos formatos para compatibilidad
    type: newRecord.type,
    costType: newRecord.cost_type,
    cost_type: newRecord.cost_type, // Mantener ambos formatos para compatibilidad
    amount: newRecord.amount,
    category: newRecord.category,
    date: newRecord.date,
    description: newRecord.description
  } : null;

  // Actualizar los datos en memoria según el tipo de evento
  if (eventType === 'INSERT') {
    // Agregar la nueva transacción a la lista
    if (!window.transactions) window.transactions = [];
    console.log('Agregando nueva transacción a la memoria:', transaction);
    window.transactions.push(transaction);
  } else if (eventType === 'UPDATE') {
    // Actualizar la transacción existente
    if (window.transactions) {
      const index = window.transactions.findIndex(t => t.id === transaction.id);
      if (index !== -1) {
        console.log('Actualizando transacción existente en la memoria:', transaction);
        window.transactions[index] = transaction;
      } else {
        // Si no se encuentra, agregarla (por si acaso)
        console.log('Transacción no encontrada para actualizar, agregándola:', transaction);
        window.transactions.push(transaction);
      }
    }
  } else if (eventType === 'DELETE') {
    // Eliminar la transacción
    if (window.transactions) {
      console.log('Eliminando transacción de la memoria:', oldRecord.id);
      window.transactions = window.transactions.filter(t => t.id !== oldRecord.id);
    }
  }

  // Actualizar la interfaz de usuario inmediatamente
  console.log('Actualizando interfaz después de cambio en transacciones...');
  if (typeof window.updateDashboard === 'function') {
    window.updateDashboard();
  } else {
    console.warn('La función updateDashboard no está disponible');
  }

  if (typeof window.updateHistoryList === 'function') {
    window.updateHistoryList();
  } else {
    console.warn('La función updateHistoryList no está disponible');
  }

  // También actualizar la visualización de ahorros ya que puede verse afectada
  if (typeof window.updateSavingsDisplay === 'function') {
    window.updateSavingsDisplay();
  } else {
    console.warn('La función updateSavingsDisplay no está disponible');
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
    console.log('Actualizando saldo de ahorros en memoria:', newRecord.balance);
    window.savingsBalance = newRecord.balance;
  }

  // Actualizar la interfaz de usuario inmediatamente
  console.log('Actualizando interfaz después de cambio en ahorros...');
  if (typeof window.updateSavingsDisplay === 'function') {
    window.updateSavingsDisplay();
  } else {
    console.warn('La función updateSavingsDisplay no está disponible');
  }

  // También actualizar el dashboard ya que puede mostrar información de ahorros
  if (typeof window.updateDashboard === 'function') {
    window.updateDashboard();
  } else {
    console.warn('La función updateDashboard no está disponible');
  }
}

// Manejador de cambios en historial de ahorros
function handleSavingsHistoryChange(payload) {
  console.log('Cambio detectado en historial de ahorros:', payload);

  // Determinar el tipo de cambio
  const eventType = payload.eventType;
  const newRecord = payload.new;
  const oldRecord = payload.old;

  // Convertir de snake_case a camelCase
  const historyEntry = newRecord ? {
    id: newRecord.id,
    userId: newRecord.user_id,
    user_id: newRecord.user_id, // Mantener ambos formatos para compatibilidad
    savings_id: newRecord.savings_id,
    savingsId: newRecord.savings_id,
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
    console.log('Agregando nueva entrada al historial de ahorros:', historyEntry);
    window.savingsHistory.push(historyEntry);
  } else if (eventType === 'UPDATE') {
    // Actualizar la entrada existente
    if (window.savingsHistory) {
      const index = window.savingsHistory.findIndex(h => h.id === historyEntry.id);
      if (index !== -1) {
        console.log('Actualizando entrada existente en historial de ahorros:', historyEntry);
        window.savingsHistory[index] = historyEntry;
      } else {
        // Si no se encuentra, agregarla (por si acaso)
        console.log('Entrada de historial no encontrada para actualizar, agregándola:', historyEntry);
        window.savingsHistory.push(historyEntry);
      }
    }
  } else if (eventType === 'DELETE') {
    // Eliminar la entrada
    if (window.savingsHistory) {
      console.log('Eliminando entrada de historial de ahorros:', oldRecord.id);
      window.savingsHistory = window.savingsHistory.filter(h => h.id !== oldRecord.id);
    }
  }

  // Actualizar la interfaz de usuario inmediatamente
  console.log('Actualizando interfaz después de cambio en historial de ahorros...');
  if (typeof window.updateSavingsDisplay === 'function') {
    window.updateSavingsDisplay();
  } else {
    console.warn('La función updateSavingsDisplay no está disponible');
  }

  // También actualizar el dashboard ya que puede mostrar información de ahorros
  if (typeof window.updateDashboard === 'function') {
    window.updateDashboard();
  } else {
    console.warn('La función updateDashboard no está disponible');
  }
}

// Función para recargar manualmente los datos
async function refreshData() {
  try {
    // Verificar si se está usando Supabase
    if (!isUsingSupabase()) {
      console.log('No se está usando Supabase, no es necesario recargar datos');
      return false;
    }

    console.log('Recargando datos desde Supabase...');

    // Obtener el cliente de Supabase
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Cliente de Supabase no disponible');
      return false;
    }

    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('No hay usuario autenticado para recargar datos');
      return false;
    }

    // Obtener el ID del usuario que se está visualizando (puede ser diferente del usuario autenticado)
    const currentUserId = sessionStorage.getItem('userId') || user.id;

    // Recargar transacciones
    console.log('Recargando transacciones para el usuario visualizado:', currentUserId);
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', currentUserId)
      .order('date', { ascending: false });

    console.log('Transacciones recargadas:', transactions ? transactions.length : 0);

    if (transactionsError) {
      console.error('Error al recargar transacciones:', transactionsError);
    } else {
      // Convertir de snake_case a camelCase
      const formattedTransactions = transactions.map(t => ({
        id: t.id,
        userId: t.user_id,
        user_id: t.user_id, // Mantener ambos formatos para compatibilidad
        type: t.type,
        costType: t.cost_type,
        cost_type: t.cost_type, // Mantener ambos formatos para compatibilidad
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description
      }));

      // Actualizar window.transactions sin perder las transacciones que aún no se han sincronizado
      if (!window.transactions) {
        window.transactions = formattedTransactions;
      } else {
        // Crear un mapa de IDs para facilitar la búsqueda
        const transactionMap = {};
        formattedTransactions.forEach(t => {
          transactionMap[t.id] = t;
        });

        // Filtrar transacciones existentes para eliminar duplicados
        const existingTransactions = window.transactions.filter(t => {
          // Si la transacción ya existe en los datos recargados, no la incluimos aquí
          // para evitar duplicados (se agregará en el siguiente paso)
          return !transactionMap[t.id];
        });

        // Combinar transacciones existentes con las recargadas
        window.transactions = [...existingTransactions, ...formattedTransactions];

        // Eliminar posibles duplicados (mismo ID)
        const uniqueTransactions = [];
        const seenIds = {};

        window.transactions.forEach(t => {
          if (!seenIds[t.id]) {
            uniqueTransactions.push(t);
            seenIds[t.id] = true;
          }
        });

        window.transactions = uniqueTransactions;
        console.log('Transacciones actualizadas sin duplicados:', window.transactions.length);
      }
    }

    // Recargar ahorros
    const { data: savings, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', currentUserId)
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
      .eq('user_id', currentUserId)
      .order('date', { ascending: false });

    if (historyError) {
      console.error('Error al recargar historial de ahorros:', historyError);
    } else {
      // Convertir de snake_case a camelCase
      const formattedHistory = history.map(h => ({
        id: h.id,
        userId: h.user_id,
        user_id: h.user_id, // Mantener ambos formatos para compatibilidad
        savings_id: h.savings_id,
        savingsId: h.savings_id,
        date: h.date,
        type: h.type,
        description: h.description,
        amount: h.amount,
        balance: h.balance
      }));

      // Actualizar window.savingsHistory sin perder entradas que aún no se han sincronizado
      if (!window.savingsHistory) {
        window.savingsHistory = formattedHistory;
      } else {
        // Crear un mapa de IDs para facilitar la búsqueda
        const historyMap = {};
        formattedHistory.forEach(h => {
          historyMap[h.id] = h;
        });

        // Filtrar entradas existentes para eliminar duplicados
        const existingHistory = window.savingsHistory.filter(h => {
          // Si la entrada ya existe en los datos recargados, no la incluimos aquí
          // para evitar duplicados (se agregará en el siguiente paso)
          return !historyMap[h.id];
        });

        // Combinar entradas existentes con las recargadas
        window.savingsHistory = [...existingHistory, ...formattedHistory];

        // Eliminar posibles duplicados (mismo ID)
        const uniqueHistory = [];
        const seenIds = {};

        window.savingsHistory.forEach(h => {
          if (!seenIds[h.id]) {
            uniqueHistory.push(h);
            seenIds[h.id] = true;
          }
        });

        window.savingsHistory = uniqueHistory;
        console.log('Historial de ahorros actualizado sin duplicados:', window.savingsHistory.length);
      }
    }

    // Actualizar la interfaz de usuario
    console.log('Actualizando la interfaz de usuario con los datos recargados');
    console.log('Transacciones disponibles:', window.transactions ? window.transactions.length : 0);

    if (typeof window.updateDashboard === 'function') {
      console.log('Llamando a updateDashboard()');
      window.updateDashboard();
    } else {
      console.warn('La función updateDashboard no está disponible');
    }

    if (typeof window.updateHistoryList === 'function') {
      console.log('Llamando a updateHistoryList()');
      window.updateHistoryList();
    } else {
      console.warn('La función updateHistoryList no está disponible');
    }

    if (typeof window.updateSavingsDisplay === 'function') {
      console.log('Llamando a updateSavingsDisplay()');
      window.updateSavingsDisplay();
    } else {
      console.warn('La función updateSavingsDisplay no está disponible');
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

function startPeriodicRefresh(intervalMs = 15000) {
  // Verificar si se está usando Supabase
  if (!isUsingSupabase()) {
    console.log('No se está usando Supabase, no se iniciará la recarga periódica');
    return false;
  }

  // Detener el intervalo anterior si existe
  stopPeriodicRefresh();

  // Realizar una recarga inmediata de datos
  refreshData();

  // Iniciar un nuevo intervalo con un tiempo más corto para mayor reactividad
  refreshInterval = setInterval(refreshData, intervalMs);
  console.log(`Recarga periódica iniciada cada ${intervalMs / 1000} segundos`);
  return true;
}

function stopPeriodicRefresh() {
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
