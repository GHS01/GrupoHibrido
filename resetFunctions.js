// Funciones para reiniciar la aplicación y los ahorros

// Función para reiniciar la aplicación (eliminar todas las transacciones, ahorros e historial de ahorros)
async function resetApplication() {
  const confirmed = await showConfirmDialog({
    title: 'Confirmar Reinicio',
    message: '¿Está seguro de que quiere reiniciar la aplicación? Esta acción eliminará todas sus transacciones y datos de ahorros.',
    icon: '⚠️',
    confirmText: 'Reiniciar',
    isDanger: true
  });

  if (confirmed) {
    try {
      console.log('Iniciando reinicio completo de la aplicación...');
      const userId = sessionStorage.getItem('userId');
      console.log('ID de usuario para reinicio completo:', userId);

      // Verificar si se debe usar Supabase
      const useSupabase = localStorage.getItem('useSupabase') === 'true';
      console.log('¿Usar Supabase para reinicio completo?', useSupabase);

      if (useSupabase) {
        console.log('Reiniciando completamente la aplicación en Supabase...');

        try {
          // Verificar si las tablas existen
          console.log('Verificando tablas en Supabase...');
          const tableStatus = await checkRequiredTables();

          // Obtener el usuario actual
          const { data: { user } } = await getSupabaseClient().auth.getUser();
          if (!user) {
            console.error('Error: Usuario no autenticado');
            showNotification('Error', 'Usuario no autenticado', 'error');
            return;
          }
          console.log('Usuario autenticado:', user.id);

          // 1. Eliminar todas las transacciones del usuario
          if (tableStatus.transactions) {
            console.log('Eliminando transacciones de Supabase...');
            const { error: transError } = await getSupabaseClient()
              .from('transactions')
              .delete()
              .eq('user_id', user.id);

            if (transError) {
              console.error('Error al eliminar transacciones:', transError);
              showNotification('Error', 'No se pudieron eliminar las transacciones', 'error');
              // Continuamos con las siguientes operaciones
            } else {
              console.log('Transacciones eliminadas correctamente de Supabase');
            }
          } else {
            console.warn('La tabla transactions no existe en Supabase');
          }

          // 2. Eliminar historial de ahorros del usuario
          if (tableStatus.savings_history) {
            console.log('Eliminando historial de ahorros de Supabase...');
            const { error: historyError } = await getSupabaseClient()
              .from('savings_history')
              .delete()
              .eq('user_id', user.id);

            if (historyError) {
              console.error('Error al eliminar historial de ahorros:', historyError);
              showNotification('Error', 'No se pudo eliminar el historial de ahorros', 'error');
              // Continuamos con las siguientes operaciones
            } else {
              console.log('Historial de ahorros eliminado correctamente de Supabase');
            }
          } else {
            console.warn('La tabla savings_history no existe en Supabase');
          }

          // 3. Actualizar el saldo de ahorros a 0 o eliminar el registro
          if (tableStatus.savings) {
            console.log('Actualizando saldo de ahorros en Supabase...');
            const { data: savings, error: savingsQueryError } = await getSupabaseClient()
              .from('savings')
              .select('id')
              .eq('user_id', user.id);

            if (savingsQueryError) {
              console.error('Error al consultar ahorros:', savingsQueryError);
              showNotification('Error', 'No se pudieron consultar los ahorros', 'error');
              // Continuamos con las siguientes operaciones
            } else {
              if (savings && savings.length > 0) {
                // Actualizar el saldo a 0
                const { error: updateError } = await getSupabaseClient()
                  .from('savings')
                  .update({ balance: 0 })
                  .eq('user_id', user.id);

                if (updateError) {
                  console.error('Error al actualizar saldo de ahorros:', updateError);
                  showNotification('Error', 'No se pudo actualizar el saldo de ahorros', 'error');
                  // Continuamos con las siguientes operaciones
                } else {
                  console.log('Saldo de ahorros actualizado a 0 en Supabase');
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
                  // Continuamos con las siguientes operaciones
                } else {
                  console.log('Registro de ahorros creado con saldo 0 en Supabase');
                }
              }
            }
          } else {
            console.warn('La tabla savings no existe en Supabase');
          }

          // Actualizar las variables locales
          window.transactions = [];
          window.savingsHistory = [];
          window.savingsBalance = 0;
          console.log('Variables locales reiniciadas');

          // Refrescar datos desde Supabase
          if (typeof window.refreshData === 'function') {
            console.log('Refrescando datos desde Supabase...');
            await window.refreshData();
          }
        } catch (supabaseError) {
          console.error('Error al reiniciar completamente con Supabase:', supabaseError);
          showNotification('Error', 'Error al reiniciar la aplicación: ' + supabaseError.message, 'error');
          return;
        }
      } else {
        // Usar IndexedDB
        console.log('Reiniciando completamente la aplicación en IndexedDB...');
        try {
          // 1. Eliminar transacciones
          const transactionTx = db.transaction(['transactions'], 'readonly');
          const transactionStore = transactionTx.objectStore('transactions');
          const transactionRequest = transactionStore.getAll();

          transactionRequest.onsuccess = async event => {
            const allTransactions = event.target.result;
            console.log('Total de transacciones en IndexedDB:', allTransactions.length);
            const userTransactions = allTransactions.filter(t => t.userId === userId);
            console.log('Transacciones del usuario a eliminar:', userTransactions.length);

            for (const transaction of userTransactions) {
              await deleteFromDb('transactions', transaction.id);
              console.log('Transacción eliminada:', transaction.id);
            }
          };

          // 2. Eliminar ahorros
          const savingsTx = db.transaction(['savings'], 'readonly');
          const savingsStore = savingsTx.objectStore('savings');
          const savingsRequest = savingsStore.getAll();

          savingsRequest.onsuccess = async event => {
            const allSavings = event.target.result;
            console.log('Total de registros de ahorros en IndexedDB:', allSavings.length);
            const userSavings = allSavings.filter(s => s.userId === userId);
            console.log('Registros de ahorros del usuario a eliminar:', userSavings.length);

            for (const saving of userSavings) {
              await deleteFromDb('savings', saving.id);
              console.log('Registro de ahorros eliminado:', saving.id);
            }
          };

          // Actualizar variables locales
          window.transactions = [];
          window.savingsHistory = [];
          window.savingsBalance = 0;
          console.log('Variables locales reiniciadas');
        } catch (indexedDBError) {
          console.error('Error al reiniciar completamente con IndexedDB:', indexedDBError);
          showNotification('Error', 'Error al reiniciar la aplicación: ' + indexedDBError.message, 'error');
          return;
        }
      }

      // Actualizar la interfaz de usuario
      try {
        console.log('Actualizando interfaz de usuario...');

        // Reiniciar gráficos
        if (window.fluxoCaixaChart) {
          fluxoCaixaChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
          fluxoCaixaChart.update();
          console.log('Gráfico de flujo de caja reiniciado');
        }

        if (window.despesasChart) {
          despesasChart.data.datasets[0].data = [0, 0, 0, 0, 0];
          despesasChart.update();
          console.log('Gráfico de gastos reiniciado');
        }

        if (window.cashFlowProjectionChart) {
          cashFlowProjectionChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
          cashFlowProjectionChart.update();
          console.log('Gráfico de proyección de flujo de caja reiniciado');
        }

        if (window.savingsChart) {
          savingsChart.data.labels = [];
          savingsChart.data.datasets[0].data = [];
          savingsChart.update();
          console.log('Gráfico de ahorros reiniciado');
        }

        // Actualizar dashboard y listas
        if (typeof window.updateDashboard === 'function') {
          updateDashboard();
          console.log('Dashboard actualizado');
        }

        if (typeof window.updateHistoryList === 'function') {
          updateHistoryList();
          console.log('Lista de historial actualizada');
        }

        if (typeof window.updateSavingsHistory === 'function') {
          updateSavingsHistory();
          console.log('Historial de ahorros actualizado');
        }

        if (typeof window.updateSavingsChart === 'function') {
          updateSavingsChart();
          console.log('Gráfico de ahorros actualizado');
        }

        if (typeof window.updateSavingsComparison === 'function') {
          updateSavingsComparison();
          console.log('Comparación de ahorros actualizada');
        }

        // Reiniciar formularios
        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm) {
          transactionForm.reset();
          console.log('Formulario de transacciones reiniciado');
        }

        const scenarioForm = document.getElementById('scenarioForm');
        if (scenarioForm) {
          scenarioForm.reset();
          console.log('Formulario de escenarios reiniciado');
        }

        console.log('Interfaz de usuario actualizada correctamente');
      } catch (uiError) {
        console.error('Error al actualizar la interfaz de usuario:', uiError);
      }

      showNotification('¡Éxito!', 'La aplicación ha sido reiniciada con éxito', 'success');
    } catch (error) {
      console.error('Error al reiniciar la aplicación:', error);
      showNotification('Error', 'No se pudo reiniciar la aplicación', 'error');
    }
  }
}

// Función para reiniciar los ahorros (eliminar savings y savings_history)
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
          // Verificar si las tablas existen
          console.log('Verificando tablas en Supabase...');
          const tableStatus = await checkRequiredTables();

          // Obtener el usuario actual
          const { data: { user } } = await getSupabaseClient().auth.getUser();
          if (!user) {
            console.error('Error: Usuario no autenticado');
            showNotification('Error', 'Usuario no autenticado', 'error');
            return;
          }
          console.log('Usuario autenticado:', user.id);

          // 1. Eliminar historial de ahorros del usuario
          if (tableStatus.savings_history) {
            console.log('Eliminando historial de ahorros de Supabase...');
            const { error: historyError } = await getSupabaseClient()
              .from('savings_history')
              .delete()
              .eq('user_id', user.id);

            if (historyError) {
              console.error('Error al eliminar historial de ahorros:', historyError);
              showNotification('Error', 'No se pudo eliminar el historial de ahorros', 'error');
              // Continuamos con las siguientes operaciones
            } else {
              console.log('Historial de ahorros eliminado correctamente de Supabase');
            }
          } else {
            console.warn('La tabla savings_history no existe en Supabase');
          }

          // 2. Actualizar el saldo de ahorros a 0 o eliminar el registro
          if (tableStatus.savings) {
            console.log('Actualizando saldo de ahorros en Supabase...');
            const { data: savings, error: savingsQueryError } = await getSupabaseClient()
              .from('savings')
              .select('id')
              .eq('user_id', user.id);

            if (savingsQueryError) {
              console.error('Error al consultar ahorros:', savingsQueryError);
              showNotification('Error', 'No se pudieron consultar los ahorros', 'error');
              // Continuamos con las siguientes operaciones
            } else {
              if (savings && savings.length > 0) {
                // Actualizar el saldo a 0
                const { error: updateError } = await getSupabaseClient()
                  .from('savings')
                  .update({ balance: 0 })
                  .eq('user_id', user.id);

                if (updateError) {
                  console.error('Error al actualizar saldo de ahorros:', updateError);
                  showNotification('Error', 'No se pudo actualizar el saldo de ahorros', 'error');
                  // Continuamos con las siguientes operaciones
                } else {
                  console.log('Saldo de ahorros actualizado a 0 en Supabase');
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
                  // Continuamos con las siguientes operaciones
                } else {
                  console.log('Registro de ahorros creado con saldo 0 en Supabase');
                }
              }
            }
          } else {
            console.warn('La tabla savings no existe en Supabase');
          }

          // Actualizar variables locales
          window.savingsBalance = 0;
          window.savingsHistory = [];
          console.log('Variables locales de ahorros reiniciadas');

          // Refrescar datos desde Supabase
          if (typeof window.refreshData === 'function') {
            console.log('Refrescando datos desde Supabase...');
            await window.refreshData();
          }
        } catch (supabaseError) {
          console.error('Error al reiniciar ahorros con Supabase:', supabaseError);
          showNotification('Error', 'Error al reiniciar ahorros: ' + supabaseError.message, 'error');
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

            // Actualizar variables locales
            window.savingsBalance = 0;
            window.savingsHistory = [];
            console.log('Variables locales de ahorros reiniciadas');
          };
        } catch (indexedDBError) {
          console.error('Error al reiniciar ahorros con IndexedDB:', indexedDBError);
          showNotification('Error', 'Error al reiniciar ahorros: ' + indexedDBError.message, 'error');
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
