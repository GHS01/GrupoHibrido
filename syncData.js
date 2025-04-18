// Función para sincronizar datos entre IndexedDB y Supabase
async function syncDataWithSupabase() {
  try {
    showNotification('Información', 'Iniciando sincronización con Supabase...', 'info');
    
    // Obtener el usuario actual
    const { data: { user } } = await getSupabaseClient().auth.getUser();
    if (!user) {
      console.error('Error: Usuario no autenticado');
      showNotification('Error', 'Usuario no autenticado', 'error');
      return;
    }
    
    const userId = sessionStorage.getItem('userId');
    
    // 1. Sincronizar transacciones
    await syncTransactions(userId, user.id);
    
    // 2. Sincronizar ahorros
    await syncSavings(userId, user.id);
    
    // 3. Sincronizar categorías
    await syncCategories(userId, user.id);
    
    // Actualizar la interfaz de usuario
    await window.loadUserData(userId);
    
    showNotification('¡Éxito!', 'Datos sincronizados correctamente con Supabase', 'success');
  } catch (error) {
    console.error('Error al sincronizar datos con Supabase:', error);
    showNotification('Error', 'No se pudieron sincronizar los datos', 'error');
  }
}

// Función para sincronizar transacciones
async function syncTransactions(localUserId, supabaseUserId) {
  try {
    console.log('Sincronizando transacciones...');
    
    // Obtener transacciones locales
    const allTransactions = await getAllFromDb('transactions');
    const localTransactions = allTransactions.filter(t => t.userId === localUserId);
    
    // Obtener transacciones de Supabase
    const { data: supabaseTransactions, error: fetchError } = await getSupabaseClient()
      .from('transactions')
      .select('*')
      .eq('user_id', supabaseUserId);
      
    if (fetchError) {
      console.error('Error al obtener transacciones de Supabase:', fetchError);
      throw fetchError;
    }
    
    // Crear un mapa de transacciones de Supabase por ID
    const supabaseTransactionsMap = {};
    supabaseTransactions.forEach(t => {
      supabaseTransactionsMap[t.id] = t;
    });
    
    // Sincronizar transacciones locales a Supabase
    for (const transaction of localTransactions) {
      // Verificar si la transacción ya existe en Supabase
      if (!supabaseTransactionsMap[transaction.id]) {
        // Convertir a formato de Supabase
        const supabaseTransaction = {
          id: transaction.id,
          user_id: supabaseUserId,
          type: transaction.type,
          amount: transaction.amount,
          category: transaction.category,
          date: transaction.date,
          description: transaction.description,
          cost_type: transaction.costType || '',
          created_at: new Date().toISOString()
        };
        
        // Insertar en Supabase
        const { error: insertError } = await getSupabaseClient()
          .from('transactions')
          .insert([supabaseTransaction]);
          
        if (insertError) {
          console.error('Error al insertar transacción en Supabase:', insertError);
          // Continuar con la siguiente transacción
          continue;
        }
      }
    }
    
    console.log('Transacciones sincronizadas correctamente');
  } catch (error) {
    console.error('Error al sincronizar transacciones:', error);
    throw error;
  }
}

// Función para sincronizar ahorros
async function syncSavings(localUserId, supabaseUserId) {
  try {
    console.log('Sincronizando ahorros...');
    
    // Obtener ahorros locales
    const allSavings = await getAllFromDb('savings');
    const localSavings = allSavings.find(s => s.userId === localUserId);
    
    if (!localSavings) {
      console.log('No hay ahorros locales para sincronizar');
      return;
    }
    
    // Verificar si ya existe un registro de ahorros en Supabase
    const { data: supabaseSavings, error: fetchError } = await getSupabaseClient()
      .from('savings')
      .select('*')
      .eq('user_id', supabaseUserId);
      
    if (fetchError) {
      console.error('Error al obtener ahorros de Supabase:', fetchError);
      throw fetchError;
    }
    
    if (supabaseSavings && supabaseSavings.length > 0) {
      // Actualizar el saldo
      const { error: updateError } = await getSupabaseClient()
        .from('savings')
        .update({ balance: localSavings.balance })
        .eq('user_id', supabaseUserId);
        
      if (updateError) {
        console.error('Error al actualizar saldo en Supabase:', updateError);
        throw updateError;
      }
    } else {
      // Crear un nuevo registro de ahorros
      const { error: insertError } = await getSupabaseClient()
        .from('savings')
        .insert([{
          user_id: supabaseUserId,
          balance: localSavings.balance,
          created_at: new Date().toISOString()
        }]);
        
      if (insertError) {
        console.error('Error al insertar ahorros en Supabase:', insertError);
        throw insertError;
      }
    }
    
    // Sincronizar historial de ahorros
    if (localSavings.history && localSavings.history.length > 0) {
      // Obtener historial de ahorros de Supabase
      const { data: supabaseHistory, error: historyError } = await getSupabaseClient()
        .from('savings_history')
        .select('*')
        .eq('user_id', supabaseUserId);
        
      if (historyError) {
        console.error('Error al obtener historial de ahorros de Supabase:', historyError);
        throw historyError;
      }
      
      // Crear un mapa de entradas de historial por fecha y tipo
      const supabaseHistoryMap = {};
      if (supabaseHistory) {
        supabaseHistory.forEach(h => {
          const key = `${h.date}_${h.type}_${h.amount}`;
          supabaseHistoryMap[key] = h;
        });
      }
      
      // Insertar entradas de historial que no existen en Supabase
      for (const entry of localSavings.history) {
        const key = `${entry.date}_${entry.type}_${entry.amount}`;
        
        if (!supabaseHistoryMap[key]) {
          const { error: insertError } = await getSupabaseClient()
            .from('savings_history')
            .insert([{
              user_id: supabaseUserId,
              date: entry.date,
              type: entry.type,
              amount: entry.amount,
              balance: entry.balance,
              description: entry.description
            }]);
            
          if (insertError) {
            console.error('Error al insertar historial de ahorros en Supabase:', insertError);
            // Continuar con la siguiente entrada
            continue;
          }
        }
      }
    }
    
    console.log('Ahorros sincronizados correctamente');
  } catch (error) {
    console.error('Error al sincronizar ahorros:', error);
    throw error;
  }
}

// Función para sincronizar categorías
async function syncCategories(localUserId, supabaseUserId) {
  try {
    console.log('Sincronizando categorías...');
    
    // Obtener categorías locales
    const localCategories = await getAllFromDb('categories');
    
    if (!localCategories || localCategories.length === 0) {
      console.log('No hay categorías locales para sincronizar');
      return;
    }
    
    // Obtener categorías de Supabase
    const { data: supabaseCategories, error: fetchError } = await getSupabaseClient()
      .from('categories')
      .select('*')
      .eq('user_id', supabaseUserId);
      
    if (fetchError) {
      console.error('Error al obtener categorías de Supabase:', fetchError);
      throw fetchError;
    }
    
    // Crear un mapa de categorías de Supabase por nombre
    const supabaseCategoriesMap = {};
    if (supabaseCategories) {
      supabaseCategories.forEach(c => {
        supabaseCategoriesMap[c.name] = c;
      });
    }
    
    // Sincronizar categorías locales a Supabase
    for (const category of localCategories) {
      // Verificar si la categoría ya existe en Supabase
      if (!supabaseCategoriesMap[category.name]) {
        // Insertar en Supabase
        const { error: insertError } = await getSupabaseClient()
          .from('categories')
          .insert([{
            name: category.name,
            color: category.color,
            user_id: supabaseUserId
          }]);
          
        if (insertError) {
          console.error('Error al insertar categoría en Supabase:', insertError);
          // Continuar con la siguiente categoría
          continue;
        }
      }
    }
    
    console.log('Categorías sincronizadas correctamente');
  } catch (error) {
    console.error('Error al sincronizar categorías:', error);
    throw error;
  }
}

// Exponer la función globalmente
window.syncDataWithSupabase = syncDataWithSupabase;
