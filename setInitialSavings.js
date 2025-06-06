// Función para establecer el saldo inicial
async function setInitialSavings() {
  try {
    const amount = parseFloat(document.getElementById('initialSavings').value);
    if (isNaN(amount)) {
      showNotification('Error', 'Por favor, ingrese un monto válido', 'error');
      return;
    }

    const userId = sessionStorage.getItem('userId');
    const date = new Date().toISOString().split('T')[0];
    const savingsEntry = {
      date,
      type: 'initial',
      amount,
      balance: amount,
      description: 'Saldo inicial'
    };

    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';

    if (useSupabase) {
      console.log('Guardando saldo inicial en Supabase...');

      try {
        // Obtener el usuario actual
        const { data: { user } } = await getSupabaseClient().auth.getUser();
        if (!user) {
          console.error('Error: Usuario no autenticado');
          showNotification('Error', 'Usuario no autenticado', 'error');
          return;
        }

        // Verificar si ya existe un registro de ahorros para el usuario
        const { data: existingSavings, error: checkError } = await getSupabaseClient()
          .from('savings')
          .select('id')
          .eq('user_id', user.id);

        if (checkError) {
          console.error('Error al verificar ahorros existentes:', checkError);
          showNotification('Error', 'No se pudieron verificar los ahorros existentes', 'error');
          return;
        }

        let savingsId;

        if (existingSavings && existingSavings.length > 0) {
          // Actualizar el registro existente
          savingsId = existingSavings[0].id;
          const { error: updateError } = await getSupabaseClient()
            .from('savings')
            .update({ balance: amount })
            .eq('id', savingsId);

          if (updateError) {
            console.error('Error al actualizar saldo:', updateError);
            showNotification('Error', 'No se pudo actualizar el saldo', 'error');
            return;
          }
        } else {
          // Crear un nuevo registro de ahorros
          savingsId = window.uuidv4(); // Generar un ID único para savings
          console.log('Creando nuevo registro de ahorros con ID:', savingsId);

          const { data: savingsData, error: savingsError } = await getSupabaseClient()
            .from('savings')
            .insert({
              id: savingsId,
              user_id: user.id,
              balance: amount,
              created_at: new Date().toISOString()
            })
            .select();

          if (savingsError) {
            console.error('Error al guardar saldo inicial:', savingsError);
            showNotification('Error', 'No se pudo guardar el saldo inicial', 'error');
            return;
          }
        }

        // Guardar en el historial de ahorros
        const historyId = window.uuidv4(); // Generar un ID único
        console.log('Insertando en savings_history con ID:', historyId);
        console.log('savings_id:', savingsId);

        const { data: historyData, error: historyError } = await getSupabaseClient()
          .from('savings_history')
          .insert({
            id: historyId,
            user_id: user.id,
            savings_id: savingsId, // Usar el ID de savings generado anteriormente
            date,
            type: 'initial',
            amount,
            balance: amount,
            description: 'Saldo inicial'
          });

        if (historyError) {
          console.error('Error al guardar historial de saldo inicial:', historyError);
          showNotification('Error', 'No se pudo guardar el historial del saldo inicial', 'error');
          return;
        }

        // Actualizar variables locales
        window.savingsBalance = amount;
        window.savingsHistory = [savingsEntry];
      } catch (supabaseError) {
        console.error('Error al establecer saldo inicial en Supabase:', supabaseError);
        showNotification('Error', 'No se pudo establecer el saldo inicial', 'error');
        return;
      }
  } else {
    // Usar IndexedDB como antes
    try {
      window.savingsBalance = amount;
      window.savingsHistory = [savingsEntry];
      const savings = {
        userId,
        balance: amount,
        history: [savingsEntry]
      };
      await addToDb('savings', savings);
    } catch (dbError) {
      console.error('Error al guardar en IndexedDB:', dbError);
      showNotification('Error', 'No se pudo guardar el saldo inicial en la base de datos local', 'error');
      return;
    }
  }

  try {
    if (typeof updateSavingsDisplay === 'function') {
      updateSavingsDisplay();
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('setSavingsModal'));
    if (modal) {
      modal.hide();
    }

    showNotification('¡Éxito!', 'Saldo inicial establecido correctamente', 'success');
  } catch (finalError) {
    console.error('Error al finalizar el proceso:', finalError);
  }
} catch (globalError) {
  console.error('Error global en setInitialSavings:', globalError);
  showNotification('Error', 'Ocurrió un error al establecer el saldo inicial', 'error');
}

// Exponer la función globalmente
window.setInitialSavings = setInitialSavings;

// Función para obtener el saldo de ahorros
function getSavingsBalance() {
  return window.savingsBalance || 0;
}

// Exponer la función de saldo de ahorros globalmente
window.getSavingsBalance = getSavingsBalance;
