// Utilidad para verificar la existencia de tablas en Supabase

// Función para verificar si una tabla existe en Supabase
async function checkTableExists(tableName) {
  try {
    console.log(`Verificando si la tabla '${tableName}' existe en Supabase...`);
    
    // Intentar hacer una consulta simple a la tabla
    const { data, error } = await getSupabaseClient()
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      // Si el error es de tipo "no existe la relación", la tabla no existe
      if (error.message && error.message.includes('does not exist')) {
        console.log(`La tabla '${tableName}' no existe en Supabase`);
        return false;
      }
      
      // Si es otro tipo de error, asumimos que la tabla existe pero hay otro problema
      console.warn(`Error al verificar la tabla '${tableName}':`, error);
      return true;
    }
    
    console.log(`La tabla '${tableName}' existe en Supabase`);
    return true;
  } catch (error) {
    console.error(`Error al verificar la tabla '${tableName}':`, error);
    return false;
  }
}

// Función para verificar todas las tablas necesarias
async function checkRequiredTables() {
  try {
    console.log('Verificando tablas requeridas en Supabase...');
    
    const requiredTables = ['transactions', 'savings', 'savings_history', 'health_check'];
    const results = {};
    
    for (const tableName of requiredTables) {
      results[tableName] = await checkTableExists(tableName);
    }
    
    console.log('Resultado de verificación de tablas:', results);
    return results;
  } catch (error) {
    console.error('Error al verificar tablas requeridas:', error);
    return {};
  }
}

// Función para crear tablas faltantes
async function createMissingTables() {
  try {
    console.log('Verificando y creando tablas faltantes...');
    
    const tableStatus = await checkRequiredTables();
    
    // Verificar si se necesita crear alguna tabla
    const needsCreation = Object.values(tableStatus).some(exists => !exists);
    
    if (!needsCreation) {
      console.log('Todas las tablas requeridas ya existen');
      return true;
    }
    
    // Aquí se podrían agregar llamadas a funciones específicas para crear cada tabla
    // Por ahora, solo mostramos un mensaje de advertencia
    console.warn('Se necesitan crear algunas tablas. Esto debe hacerse desde el panel de administración de Supabase.');
    
    return false;
  } catch (error) {
    console.error('Error al crear tablas faltantes:', error);
    return false;
  }
}

// Exponer las funciones globalmente
window.checkTableExists = checkTableExists;
window.checkRequiredTables = checkRequiredTables;
window.createMissingTables = createMissingTables;
