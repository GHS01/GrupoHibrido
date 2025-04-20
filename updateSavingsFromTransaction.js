// Función para actualizar los ahorros a partir de una transacción
async function updateSavingsFromTransaction(transaction) {
  try {
    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';

    // Obtener la fecha actual
    const date = new Date().toISOString().split('T')[0];

    // Calcular el nuevo saldo
    let newBalance = window.savingsBalance || 0;
    let amount = 0;
    let type = '';

    if (transaction.type === 'entrada') {
      amount = transaction.amount;
      newBalance += amount;
      type = 'ingreso';
    } else {
      amount = -transaction.amount;
      newBalance += amount;
      type = 'gasto';
    }

    // Crear el registro de historial
    const historyEntry = {
      date,
      type,
      amount,
      balance: newBalance,
      description: `${transaction.type === 'entrada' ? 'Ingreso' : 'Gasto'}: ${transaction.description}`
    };

    if (useSupabase) {
      console.log('Actualizando ahorros en Supabase...');

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        showNotification('Error', 'Usuario no autenticado', 'error');
        return;
      }

      // Verificar si existe un registro de ahorros para el usuario
      const { data: savingsData, error: savingsError } = await getSupabaseClient()
        .from('savings')
        .select('id')
        .eq('user_id', user.id);

      if (savingsError) {
        console.error('Error al verificar ahorros:', savingsError);
        showNotification('Error', 'No se pudieron verificar los ahorros', 'error');
        return;
      }

      if (savingsData && savingsData.length > 0) {
        // Actualizar el saldo
        const { error: updateError } = await getSupabaseClient()
          .from('savings')
          .update({ balance: newBalance })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error al actualizar saldo:', updateError);
          showNotification('Error', 'No se pudo actualizar el saldo', 'error');
          return;
        }
      } else {
        // Crear un nuevo registro de ahorros
        const { error: insertError } = await getSupabaseClient()
          .from('savings')
          .insert([{
            id: window.uuidv4(), // Generar un ID único
            user_id: user.id,
            balance: newBalance,
            created_at: new Date().toISOString()
          }]);

        if (insertError) {
          console.error('Error al crear registro de ahorros:', insertError);
          showNotification('Error', 'No se pudo crear el registro de ahorros', 'error');
          return;
        }
      }

      // Obtener el ID de savings para este usuario
      const { data: userSavings, error: savingsQueryError } = await getSupabaseClient()
        .from('savings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (savingsQueryError) {
        console.error('Error al obtener savings_id:', savingsQueryError);
        showNotification('Error', 'No se pudo obtener el ID de ahorros', 'error');
        return;
      }

      if (!userSavings || !userSavings.id) {
        console.error('No se encontró un registro de ahorros para el usuario');
        showNotification('Error', 'No se encontró un registro de ahorros para el usuario', 'error');
        return;
      }

      // Verificar si ya existe una entrada para esta fecha y tipo
      console.log('Verificando si ya existe una entrada para esta fecha y tipo...');
      const { data: existingEntries, error: checkError } = await getSupabaseClient()
        .from('savings_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', historyEntry.date)
        .ilike('type', historyEntry.type);

      if (checkError) {
        console.error('Error al verificar entradas existentes:', checkError);
        // Continuar con la inserción aunque haya error en la verificación
      } else if (existingEntries && existingEntries.length > 0) {
        console.log('Ya existe una entrada para esta fecha y tipo. Actualizando en lugar de insertar.');

        // Actualizar la entrada existente más reciente
        const latestEntry = existingEntries.sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        )[0];

        const { error: updateHistoryError } = await getSupabaseClient()
          .from('savings_history')
          .update({
            description: historyEntry.description,
            amount: historyEntry.amount,
            balance: historyEntry.balance
          })
          .eq('id', latestEntry.id);

        if (updateHistoryError) {
          console.error('Error al actualizar historial existente:', updateHistoryError);
          showNotification('Error', 'No se pudo actualizar el historial de ahorros', 'error');
          return;
        }
      } else {
        // Si no existe, insertar nueva entrada
        const historyId = window.uuidv4(); // Generar un ID único
        console.log('Insertando en savings_history con ID:', historyId);
        console.log('savings_id:', userSavings.id);

        const { error: historyError } = await getSupabaseClient()
          .from('savings_history')
          .insert({
            id: historyId,
            user_id: user.id,
            savings_id: userSavings.id,
            date: historyEntry.date,
            type: historyEntry.type,
            amount: historyEntry.amount,
            balance: historyEntry.balance,
            description: historyEntry.description
          });

        if (historyError) {
          console.error('Error al guardar historial de ahorros:', historyError);
          showNotification('Error', 'No se pudo guardar el historial de ahorros', 'error');
          return;
        }
      }



      // Actualizar variables locales
      window.savingsBalance = newBalance;
      if (!window.savingsHistory) window.savingsHistory = [];
      window.savingsHistory.push(historyEntry);

    } else {
      // Usar IndexedDB
      const userId = sessionStorage.getItem('userId');

      // Actualizar variables locales
      window.savingsBalance = newBalance;
      if (!window.savingsHistory) window.savingsHistory = [];
      window.savingsHistory.push(historyEntry);

      // Guardar en IndexedDB
      const savings = {
        userId,
        balance: newBalance,
        history: window.savingsHistory
      };

      // Verificar si ya existe un registro de ahorros para el usuario
      const allSavings = await getAllFromDb('savings');
      const existingSavings = allSavings.find(s => s.userId === userId);

      if (existingSavings) {
        // Actualizar el registro existente
        await putToDb('savings', savings);
      } else {
        // Crear un nuevo registro
        await addToDb('savings', savings);
      }
    }

    // Actualizar la interfaz de usuario
    updateSavingsDisplay();

  } catch (error) {
    console.error('Error al actualizar ahorros desde transacción:', error);
    showNotification('Error', 'No se pudieron actualizar los ahorros', 'error');
  }
}

// Exponer la función globalmente
window.updateSavingsFromTransaction = updateSavingsFromTransaction;
