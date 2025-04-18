// Servicio de migración de IndexedDB a Supabase
import { supabase } from './supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

// Función principal para migrar datos
export async function migrateToSupabase(db) {
  try {
    // 1. Exportar datos de IndexedDB
    const data = await exportIndexedDBData(db);
    
    // 2. Migrar datos a Supabase
    await migrateDataToSupabase(data);
    
    return { success: true, message: 'Migración completada con éxito' };
  } catch (error) {
    console.error('Error en la migración:', error);
    return { success: false, message: 'Error en la migración: ' + error.message };
  }
}

// Función para exportar datos de IndexedDB
async function exportIndexedDBData(db) {
  try {
    const data = {
      users: [],
      teams: [],
      transactions: [],
      categories: [],
      savings: []
    };
    
    // Exportar usuarios
    data.users = await getAllFromIndexedDB(db, 'users');
    
    // Exportar equipos
    data.teams = await getAllFromIndexedDB(db, 'teams');
    
    // Exportar transacciones
    data.transactions = await getAllFromIndexedDB(db, 'transactions');
    
    // Exportar categorías
    data.categories = await getAllFromIndexedDB(db, 'categories');
    
    // Exportar ahorros
    data.savings = await getAllFromIndexedDB(db, 'savings');
    
    return data;
  } catch (error) {
    console.error('Error en exportIndexedDBData:', error);
    throw error;
  }
}

// Función auxiliar para obtener todos los datos de un almacén en IndexedDB
function getAllFromIndexedDB(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Función para migrar datos a Supabase
async function migrateDataToSupabase(data) {
  try {
    // 1. Migrar equipos
    if (data.teams && data.teams.length > 0) {
      console.log(`Migrando ${data.teams.length} equipos...`);
      for (const team of data.teams) {
        const { error } = await supabase
          .from('teams')
          .upsert([{
            id: team.id,
            name: team.name,
            code: team.code || generateTeamCode(team.name),
            password: team.password || 'password123',
            created_by: team.createdBy || 'migration@system.com'
          }]);
        
        if (error && error.code !== '23505') { // Ignorar errores de duplicados
          console.error('Error al migrar equipo:', error);
        }
      }
    }
    
    // 2. Migrar usuarios
    if (data.users && data.users.length > 0) {
      console.log(`Migrando ${data.users.length} usuarios...`);
      for (const user of data.users) {
        // Crear perfil de usuario en la tabla users
        const { error: profileError } = await supabase
          .from('users')
          .upsert([{
            id: user.id,
            username: user.username,
            email: user.email,
            password: user.password, // Nota: esto es solo para mantener compatibilidad, la autenticación real se hará con Auth
            is_admin: user.isAdmin,
            team_id: user.teamId,
            team_name: user.teamName,
            team_code: user.teamCode
          }]);
        
        if (profileError) {
          console.error('Error al migrar perfil de usuario:', profileError);
        }
      }
    }
    
    // 3. Migrar categorías
    if (data.categories && data.categories.length > 0) {
      console.log(`Migrando ${data.categories.length} categorías...`);
      for (const category of data.categories) {
        const { error } = await supabase
          .from('categories')
          .upsert([{
            name: category.name,
            color: category.color
          }]);
        
        if (error && error.code !== '23505') {
          console.error('Error al migrar categoría:', error);
        }
      }
    }
    
    // 4. Migrar transacciones
    if (data.transactions && data.transactions.length > 0) {
      console.log(`Migrando ${data.transactions.length} transacciones...`);
      for (const transaction of data.transactions) {
        const { error } = await supabase
          .from('transactions')
          .upsert([{
            id: transaction.id,
            user_id: transaction.userId,
            type: transaction.type,
            cost_type: transaction.costType,
            amount: transaction.amount,
            category: transaction.category,
            date: transaction.date,
            description: transaction.description
          }]);
        
        if (error && error.code !== '23505') {
          console.error('Error al migrar transacción:', error);
        }
      }
    }
    
    // 5. Migrar ahorros
    if (data.savings && data.savings.length > 0) {
      console.log(`Migrando ${data.savings.length} registros de ahorros...`);
      for (const saving of data.savings) {
        // Crear registro de ahorros
        const { data: savingsData, error } = await supabase
          .from('savings')
          .upsert([{
            id: saving.id,
            user_id: saving.userId,
            balance: saving.balance
          }])
          .select();
        
        if (error && error.code !== '23505') {
          console.error('Error al migrar ahorros:', error);
          continue;
        }
        
        const savingsId = savingsData?.[0]?.id || saving.id;
        
        // Migrar historial de ahorros
        if (saving.history && saving.history.length > 0) {
          console.log(`Migrando ${saving.history.length} registros de historial de ahorros...`);
          for (const historyItem of saving.history) {
            const { error: historyError } = await supabase
              .from('savings_history')
              .insert([{
                id: uuidv4(),
                savings_id: savingsId,
                user_id: saving.userId,
                date: historyItem.date,
                type: historyItem.type,
                description: historyItem.description,
                amount: historyItem.amount,
                balance: historyItem.balance
              }]);
            
            if (historyError) {
              console.error('Error al migrar historial de ahorros:', historyError);
            }
          }
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error en migrateDataToSupabase:', error);
    throw error;
  }
}

// Función auxiliar para generar un código de equipo
function generateTeamCode(teamName) {
  const teamPrefix = teamName.substring(0, 4).toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${teamPrefix}-${randomNum}`;
}
