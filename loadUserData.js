// Función para cargar los datos del usuario desde la base de datos
async function loadUserData(userId) {
  try {
    console.log('Cargando datos del usuario:', userId);
    
    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';
    
    if (useSupabase) {
      console.log('Cargando datos desde Supabase...');
      
      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        showNotification('Error', 'Usuario no autenticado', 'error');
        return;
      }
      
      // Cargar transacciones
      const { data: transactionsData, error: transactionsError } = await getSupabaseClient()
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);
        
      if (transactionsError) {
        console.error('Error al cargar transacciones:', transactionsError);
        showNotification('Error', 'No se pudieron cargar las transacciones', 'error');
        return;
      }
      
      // Convertir de snake_case a camelCase para mantener compatibilidad
      window.transactions = transactionsData.map(t => ({
        id: t.id,
        userId: t.user_id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description,
        costType: t.cost_type || ''
      }));
      
      console.log(`${window.transactions.length} transacciones cargadas desde Supabase`);
      
      // Cargar ahorros
      const { data: savingsData, error: savingsError } = await getSupabaseClient()
        .from('savings')
        .select('*')
        .eq('user_id', user.id);
        
      if (savingsError) {
        console.error('Error al cargar ahorros:', savingsError);
        showNotification('Error', 'No se pudieron cargar los ahorros', 'error');
        return;
      }
      
      if (savingsData && savingsData.length > 0) {
        window.savingsBalance = savingsData[0].balance;
        
        // Cargar historial de ahorros
        const { data: historyData, error: historyError } = await getSupabaseClient()
          .from('savings_history')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true });
          
        if (historyError) {
          console.error('Error al cargar historial de ahorros:', historyError);
          showNotification('Error', 'No se pudo cargar el historial de ahorros', 'error');
          return;
        }
        
        // Convertir de snake_case a camelCase para mantener compatibilidad
        window.savingsHistory = historyData.map(h => ({
          date: h.date,
          type: h.type,
          amount: h.amount,
          balance: h.balance,
          description: h.description
        }));
        
        console.log(`${window.savingsHistory.length} registros de historial de ahorros cargados desde Supabase`);
      } else {
        window.savingsBalance = 0;
        window.savingsHistory = [];
      }
      
      // Cargar categorías
      await window.loadCategories();
      
    } else {
      console.log('Cargando datos desde IndexedDB...');
      
      // Cargar transacciones desde IndexedDB
      const allTransactions = await getAllFromDb('transactions');
      window.transactions = allTransactions.filter(t => t.userId === userId);
      
      // Cargar ahorros desde IndexedDB
      const allSavings = await getAllFromDb('savings');
      const userSavings = allSavings.find(s => s.userId === userId);
      
      if (userSavings) {
        window.savingsBalance = userSavings.balance;
        window.savingsHistory = userSavings.history || [];
      } else {
        window.savingsBalance = 0;
        window.savingsHistory = [];
      }
      
      // Cargar categorías desde IndexedDB
      await window.loadCategories();
    }
    
    // Actualizar la interfaz de usuario
    updateDashboard();
    updateHistoryList();
    updateSavingsDisplay();
    
    console.log('Datos del usuario cargados correctamente');
    return true;
  } catch (error) {
    console.error('Error al cargar datos del usuario:', error);
    showNotification('Error', 'No se pudieron cargar los datos del usuario', 'error');
    return false;
  }
}

// Exponer la función globalmente
window.loadUserData = loadUserData;
