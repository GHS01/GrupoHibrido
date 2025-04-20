// Funciones para reiniciar la aplicación y los ahorros

// Función para reiniciar la aplicación (eliminar todas las transacciones)
async function resetApplication() {
  const confirmed = await showConfirmDialog({
    title: 'Confirmar Reinicio',
    message: '¿Está seguro de que quiere reiniciar la aplicación? Esta acción eliminará todas sus transacciones.',
    icon: '⚠️',
    confirmText: 'Reiniciar',
    isDanger: true
  });
  
  if (confirmed) {
    try {
      const userId = sessionStorage.getItem('userId');
      
      // Verificar si se debe usar Supabase
      const useSupabase = localStorage.getItem('useSupabase') === 'true';
      
      if (useSupabase) {
        console.log('Reiniciando aplicación en Supabase...');
        
        // Obtener el usuario actual
        const { data: { user } } = await getSupabaseClient().auth.getUser();
        if (!user) {
          console.error('Error: Usuario no autenticado');
          showNotification('Error', 'Usuario no autenticado', 'error');
          return;
        }
        
        // Eliminar todas las transacciones del usuario
        const { error } = await getSupabaseClient()
          .from('transactions')
          .delete()
          .eq('user_id', user.id);
          
        if (error) {
          console.error('Error al eliminar transacciones:', error);
          showNotification('Error', 'No se pudieron eliminar las transacciones', 'error');
          return;
        }
        
        // Actualizar la lista local de transacciones
        window.transactions = [];
      } else {
        // Usar IndexedDB
        const transaction = db.transaction(['transactions'], 'readonly');
        const store = transaction.objectStore('transactions');
        const request = store.getAll();
        
        request.onsuccess = async event => {
          const allTransactions = event.target.result;
          const userTransactions = allTransactions.filter(t => t.userId === userId);
          
          for (const transaction of userTransactions) {
            await deleteFromDb('transactions', transaction.id);
          }
          
          transactions = transactions.filter(t => t.userId !== userId);
        };
      }
      
      // Actualizar la interfaz de usuario
      fluxoCaixaChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
      fluxoCaixaChart.update();
      despesasChart.data.datasets[0].data = [0, 0, 0, 0, 0];
      despesasChart.update();
      cashFlowProjectionChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
      cashFlowProjectionChart.update();
      updateDashboard();
      document.getElementById('transactionForm').reset();
      document.getElementById('scenarioForm').reset();
      
      showNotification('¡Éxito!', 'La aplicación ha sido reiniciada con éxito', 'success');
    } catch (error) {
      console.error('Error al reiniciar la aplicación:', error);
      showNotification('Error', 'No se pudo reiniciar la aplicación', 'error');
    }
  }
}

// Función para reiniciar los ahorros
async function resetSavings() {
  const confirmed = await showConfirmDialog({
    title: 'Confirmar Reinicio de Saldo/Ahorros',
    message: '¿Está seguro de que quiere reiniciar la sección de Saldo/Ahorros? Esta acción eliminará todo el historial de ahorros y el saldo actual.',
    icon: '💰',
    confirmText: 'Reiniciar',
    isDanger: true
  });
  
  if (confirmed) {
    try {
      const userId = sessionStorage.getItem('userId');
      
      // Verificar si se debe usar Supabase
      const useSupabase = localStorage.getItem('useSupabase') === 'true';
      
      if (useSupabase) {
        console.log('Reiniciando ahorros en Supabase...');
        
        // Obtener el usuario actual
        const { data: { user } } = await getSupabaseClient().auth.getUser();
        if (!user) {
          console.error('Error: Usuario no autenticado');
          showNotification('Error', 'Usuario no autenticado', 'error');
          return;
        }
        
        // Obtener el registro de ahorros del usuario
        const { data: savings, error: savingsError } = await getSupabaseClient()
          .from('savings')
          .select('id')
          .eq('user_id', user.id);
          
        if (savingsError) {
          console.error('Error al obtener ahorros:', savingsError);
          showNotification('Error', 'No se pudieron obtener los ahorros', 'error');
          return;
        }
        
        if (savings && savings.length > 0) {
          // Actualizar el saldo a 0
          const { error: updateError } = await getSupabaseClient()
            .from('savings')
            .update({ balance: 0 })
            .eq('user_id', user.id);
            
          if (updateError) {
            console.error('Error al actualizar saldo:', updateError);
            showNotification('Error', 'No se pudo actualizar el saldo', 'error');
            return;
          }
          
          // Eliminar el historial de ahorros
          const { error: historyError } = await getSupabaseClient()
            .from('savings_history')
            .delete()
            .eq('user_id', user.id);
            
          if (historyError) {
            console.error('Error al eliminar historial de ahorros:', historyError);
            showNotification('Error', 'No se pudo eliminar el historial de ahorros', 'error');
            return;
          }
        } else {
          // Crear un registro de ahorros con saldo 0
          const { error: insertError } = await getSupabaseClient()
            .from('savings')
            .insert([{
              user_id: user.id,
              balance: 0,
              created_at: new Date().toISOString()
            }]);
            
          if (insertError) {
            console.error('Error al crear registro de ahorros:', insertError);
            showNotification('Error', 'No se pudo crear el registro de ahorros', 'error');
            return;
          }
        }
        
        // Actualizar variables locales
        window.savingsBalance = 0;
        window.savingsHistory = [];
      } else {
        // Usar IndexedDB
        const transaction = db.transaction(['savings'], 'readonly');
        const store = transaction.objectStore('savings');
        const request = store.getAll();
        
        request.onsuccess = async event => {
          const allSavings = event.target.result;
          const userSavings = allSavings.filter(s => s.userId === userId);
          
          for (const saving of userSavings) {
            await deleteFromDb('savings', saving.id);
          }
          
          savingsBalance = 0;
          savingsHistory = [];
        };
      }
      
      // Actualizar la interfaz de usuario
      updateSavingsDisplay();
      showNotification('¡Éxito!', 'La sección de Saldo/Ahorros ha sido reiniciada con éxito', 'success');
    } catch (error) {
      console.error('Error al reiniciar ahorros:', error);
      showNotification('Error', 'No se pudieron reiniciar los ahorros', 'error');
    }
  }
}

// Exponer las funciones globalmente
window.resetApplication = resetApplication;
window.resetSavings = resetSavings;
