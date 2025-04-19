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
      console.log('Iniciando reinicio de la aplicación...');
      const userId = sessionStorage.getItem('userId');
      console.log('ID de usuario para reinicio:', userId);

      // Verificar si se debe usar Supabase
      const useSupabase = localStorage.getItem('useSupabase') === 'true';
      console.log('¿Usar Supabase para reinicio?', useSupabase);

      if (useSupabase) {
        console.log('Reiniciando aplicación en Supabase...');

        try {
          // Obtener el usuario actual
          const { data: { user } } = await getSupabaseClient().auth.getUser();
          if (!user) {
            console.error('Error: Usuario no autenticado');
            showNotification('Error', 'Usuario no autenticado', 'error');
            return;
          }
          console.log('Usuario autenticado:', user.id);

          // Eliminar todas las transacciones del usuario
          console.log('Eliminando transacciones de Supabase...');
          const { error } = await getSupabaseClient()
            .from('transactions')
            .delete()
            .eq('user_id', user.id);

          if (error) {
            console.error('Error al eliminar transacciones:', error);
            showNotification('Error', 'No se pudieron eliminar las transacciones', 'error');
            return;
          }

          console.log('Transacciones eliminadas correctamente de Supabase');

          // Actualizar la lista local de transacciones
          if (window.transactions) {
            window.transactions = window.transactions.filter(t => t.userId !== userId && t.user_id !== user.id);
            console.log('Lista local de transacciones actualizada');
          } else {
            window.transactions = [];
            console.log('Lista local de transacciones inicializada');
          }

          // Refrescar datos desde Supabase
          if (typeof window.refreshData === 'function') {
            console.log('Refrescando datos desde Supabase...');
            await window.refreshData();
          }
        } catch (supabaseError) {
          console.error('Error al reiniciar con Supabase:', supabaseError);
          showNotification('Error', 'Error al reiniciar con Supabase: ' + supabaseError.message, 'error');
          return;
        }
      } else {
        // Usar IndexedDB
        console.log('Reiniciando aplicación en IndexedDB...');
        try {
          const transaction = db.transaction(['transactions'], 'readonly');
          const store = transaction.objectStore('transactions');
          const request = store.getAll();

          request.onsuccess = async event => {
            const allTransactions = event.target.result;
            console.log('Total de transacciones en IndexedDB:', allTransactions.length);
            const userTransactions = allTransactions.filter(t => t.userId === userId);
            console.log('Transacciones del usuario a eliminar:', userTransactions.length);

            for (const transaction of userTransactions) {
              await deleteFromDb('transactions', transaction.id);
              console.log('Transacción eliminada:', transaction.id);
            }

            if (window.transactions) {
              window.transactions = window.transactions.filter(t => t.userId !== userId);
              console.log('Lista local de transacciones actualizada');
            }
          };
        } catch (indexedDBError) {
          console.error('Error al reiniciar con IndexedDB:', indexedDBError);
          showNotification('Error', 'Error al reiniciar con IndexedDB: ' + indexedDBError.message, 'error');
          return;
        }
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
      console.log('Iniciando reinicio de ahorros...');
      const userId = sessionStorage.getItem('userId');
      console.log('ID de usuario para reinicio de ahorros:', userId);

      // Verificar si se debe usar Supabase
      const useSupabase = localStorage.getItem('useSupabase') === 'true';
      console.log('¿Usar Supabase para reinicio de ahorros?', useSupabase);

      if (useSupabase) {
        console.log('Reiniciando ahorros en Supabase...');

        try {
          // Obtener el usuario actual
          const { data: { user } } = await getSupabaseClient().auth.getUser();
          if (!user) {
            console.error('Error: Usuario no autenticado');
            showNotification('Error', 'Usuario no autenticado', 'error');
            return;
          }
          console.log('Usuario autenticado:', user.id);

          // Obtener el registro de ahorros del usuario
          console.log('Obteniendo registros de ahorros...');
          const { data: savings, error: savingsError } = await getSupabaseClient()
            .from('savings')
            .select('id')
            .eq('user_id', user.id);

          if (savingsError) {
            console.error('Error al obtener ahorros:', savingsError);
            showNotification('Error', 'No se pudieron obtener los ahorros', 'error');
            return;
          }

          console.log('Registros de ahorros encontrados:', savings ? savings.length : 0);

          if (savings && savings.length > 0) {
            // Actualizar el saldo a 0
            console.log('Actualizando saldo a 0...');
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
            console.log('Eliminando historial de ahorros...');
            const { error: historyError } = await getSupabaseClient()
              .from('savings_history')
              .delete()
              .eq('user_id', user.id);

            if (historyError) {
              console.error('Error al eliminar historial de ahorros:', historyError);
              showNotification('Error', 'No se pudo eliminar el historial de ahorros', 'error');
              return;
            }

            console.log('Historial de ahorros eliminado correctamente');
          } else {
            // Crear un registro de ahorros con saldo 0
            console.log('Creando nuevo registro de ahorros con saldo 0...');
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

            console.log('Nuevo registro de ahorros creado correctamente');
          }

          // Actualizar variables locales
          console.log('Actualizando variables locales...');
          window.savingsBalance = 0;
          window.savingsHistory = [];

          // Refrescar datos desde Supabase
          if (typeof window.refreshData === 'function') {
            console.log('Refrescando datos desde Supabase...');
            await window.refreshData();
          }
        } catch (supabaseError) {
          console.error('Error al reiniciar ahorros con Supabase:', supabaseError);
          showNotification('Error', 'Error al reiniciar ahorros con Supabase: ' + supabaseError.message, 'error');
          return;
        }
      } else {
        // Usar IndexedDB
        console.log('Reiniciando ahorros en IndexedDB...');
        try {
          const transaction = db.transaction(['savings'], 'readonly');
          const store = transaction.objectStore('savings');
          const request = store.getAll();

          request.onsuccess = async event => {
            const allSavings = event.target.result;
            console.log('Total de registros de ahorros en IndexedDB:', allSavings.length);
            const userSavings = allSavings.filter(s => s.userId === userId);
            console.log('Registros de ahorros del usuario a eliminar:', userSavings.length);

            for (const saving of userSavings) {
              await deleteFromDb('savings', saving.id);
              console.log('Registro de ahorros eliminado:', saving.id);
            }

            if (window.savingsBalance !== undefined) {
              window.savingsBalance = 0;
              console.log('Saldo de ahorros reiniciado a 0');
            }

            if (window.savingsHistory) {
              window.savingsHistory = [];
              console.log('Historial de ahorros reiniciado');
            }
          };
        } catch (indexedDBError) {
          console.error('Error al reiniciar ahorros con IndexedDB:', indexedDBError);
          showNotification('Error', 'Error al reiniciar ahorros con IndexedDB: ' + indexedDBError.message, 'error');
          return;
        }
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
