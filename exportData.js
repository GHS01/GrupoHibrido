// Función para exportar datos a CSV
async function exportTransactionsToCSV() {
  try {
    // Verificar si se debe usar Supabase
    const useSupabase = localStorage.getItem('useSupabase') === 'true';
    
    let transactionsToExport = [];
    
    if (useSupabase) {
      console.log('Exportando datos desde Supabase...');
      
      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        showNotification('Error', 'Usuario no autenticado', 'error');
        return;
      }
      
      // Obtener todas las transacciones del usuario
      const { data, error } = await getSupabaseClient()
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error al obtener transacciones:', error);
        showNotification('Error', 'No se pudieron obtener las transacciones', 'error');
        return;
      }
      
      // Convertir de snake_case a camelCase para mantener compatibilidad
      transactionsToExport = data.map(t => ({
        id: t.id,
        userId: t.user_id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description,
        costType: t.cost_type || ''
      }));
    } else {
      // Usar datos locales
      transactionsToExport = window.transactions || [];
    }
    
    // Verificar si hay transacciones para exportar
    if (!transactionsToExport || transactionsToExport.length === 0) {
      showNotification('Información', 'No hay transacciones para exportar', 'info');
      return;
    }
    
    // Crear el contenido CSV
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Tipo de Costo'];
    let csvContent = headers.join(';') + '\n';
    
    transactionsToExport.forEach(transaction => {
      const row = [
        transaction.date,
        transaction.type === 'entrada' ? 'Ingreso' : 'Gasto',
        transaction.category,
        transaction.description,
        transaction.amount.toFixed(2),
        transaction.costType || ''
      ];
      csvContent += row.join(';') + '\n';
    });
    
    // Crear un blob y descargar el archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'transacciones.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('¡Éxito!', 'Transacciones exportadas correctamente', 'success');
  } catch (error) {
    console.error('Error al exportar transacciones:', error);
    showNotification('Error', 'No se pudieron exportar las transacciones', 'error');
  }
}

// Exponer la función globalmente
window.exportTransactionsToCSV = exportTransactionsToCSV;
