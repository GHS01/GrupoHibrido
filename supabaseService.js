// Supabase Service - Reemplazo para las funciones de IndexedDB
import { supabase } from './supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

// Funciones de autenticación
export async function signUp(email, password, username, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  try {
    // 1. Registrar el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    // 2. Crear el perfil del usuario en la tabla users
    const userId = authData.user.id;
    const { error: profileError } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          username,
          email,
          is_admin: isAdmin,
          team_id: teamId,
          team_name: teamName,
          team_code: teamCode
        }
      ]);

    if (profileError) throw profileError;

    // 3. Crear un registro de ahorros para el usuario
    const { error: savingsError } = await supabase
      .from('savings')
      .insert([
        {
          id: uuidv4(),
          user_id: userId,
          balance: 0
        }
      ]);

    if (savingsError) throw savingsError;

    return { user: authData.user, profile: { username, isAdmin, teamId, teamName, teamCode } };
  } catch (error) {
    console.error('Error en signUp:', error);
    throw error;
  }
}

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Obtener el perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) throw profileError;

    return { user: data.user, profile };
  } catch (error) {
    console.error('Error en signIn:', error);
    throw error;
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error en signOut:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) throw error;
    if (!user) return null;

    // Obtener el perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    return { user, profile };
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    return null;
  }
}

// Funciones CRUD para equipos (teams)
export async function createTeam(name, password, createdBy) {
  try {
    const id = uuidv4();
    
    // Generar código de equipo
    const teamPrefix = name.substring(0, 4).toUpperCase();
    
    // Verificar si ya existe un equipo con el mismo nombre
    const { data: existingTeams, error: queryError } = await supabase
      .from('teams')
      .select('code')
      .ilike('name', name);
    
    if (queryError) throw queryError;
    
    // Generar un código único
    let teamNumber = existingTeams.length + 1;
    let isCodeUnique = false;
    let code = '';
    
    while (!isCodeUnique) {
      code = `${teamPrefix}-${teamNumber.toString().padStart(4, '0')}`;
      
      // Verificar si este código ya existe
      const { data: existingCode, error: codeError } = await supabase
        .from('teams')
        .select('id')
        .eq('code', code);
      
      if (codeError) throw codeError;
      
      if (existingCode.length === 0) {
        isCodeUnique = true;
      } else {
        teamNumber++;
      }
    }
    
    // Crear el equipo
    const { data, error } = await supabase
      .from('teams')
      .insert([
        {
          id,
          name,
          code,
          password,
          created_by: createdBy
        }
      ])
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error en createTeam:', error);
    throw error;
  }
}

export async function getTeamByCode(code) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error en getTeamByCode:', error);
    throw error;
  }
}

export async function getAllTeams() {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*');
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error en getAllTeams:', error);
    throw error;
  }
}

// Funciones CRUD para transacciones (transactions)
export async function addTransaction(transaction) {
  try {
    // Asegurarse de que la transacción tenga un ID
    if (!transaction.id) {
      transaction.id = uuidv4();
    }
    
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    // Asignar el ID de usuario a la transacción
    transaction.user_id = user.id;
    
    // Convertir nombres de propiedades a snake_case para Supabase
    const supabaseTransaction = {
      id: transaction.id,
      user_id: transaction.user_id,
      type: transaction.type,
      cost_type: transaction.costType,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      description: transaction.description
    };
    
    const { data, error } = await supabase
      .from('transactions')
      .insert([supabaseTransaction])
      .select();
    
    if (error) throw error;
    
    // Actualizar el saldo de ahorros
    await updateSavingsFromTransaction(supabaseTransaction);
    
    return data[0];
  } catch (error) {
    console.error('Error en addTransaction:', error);
    throw error;
  }
}

export async function updateTransaction(transaction) {
  try {
    // Convertir nombres de propiedades a snake_case para Supabase
    const supabaseTransaction = {
      id: transaction.id,
      user_id: transaction.userId || transaction.user_id,
      type: transaction.type,
      cost_type: transaction.costType || transaction.cost_type,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      description: transaction.description
    };
    
    const { data, error } = await supabase
      .from('transactions')
      .update(supabaseTransaction)
      .eq('id', transaction.id)
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error en updateTransaction:', error);
    throw error;
  }
}

export async function deleteTransaction(id) {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error en deleteTransaction:', error);
    throw error;
  }
}

export async function getUserTransactions() {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Convertir de snake_case a camelCase para mantener compatibilidad
    return data.map(t => ({
      id: t.id,
      userId: t.user_id,
      type: t.type,
      costType: t.cost_type,
      amount: t.amount,
      category: t.category,
      date: t.date,
      description: t.description
    }));
  } catch (error) {
    console.error('Error en getUserTransactions:', error);
    throw error;
  }
}

// Funciones CRUD para categorías (categories)
export async function addCategory(category) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([category])
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error en addCategory:', error);
    throw error;
  }
}

export async function updateCategory(category) {
  try {
    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('name', category.name)
      .select();
    
    if (error) throw error;
    
    return data[0];
  } catch (error) {
    console.error('Error en updateCategory:', error);
    throw error;
  }
}

export async function deleteCategory(name) {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('name', name);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error en deleteCategory:', error);
    throw error;
  }
}

export async function getAllCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*');
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error en getAllCategories:', error);
    throw error;
  }
}

// Funciones para ahorros (savings)
export async function getUserSavings() {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    const { data, error } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      // Si no existe, crear un registro de ahorros para el usuario
      if (error.code === 'PGRST116') {
        const newSavings = {
          id: uuidv4(),
          user_id: user.id,
          balance: 0
        };
        
        const { data: newData, error: newError } = await supabase
          .from('savings')
          .insert([newSavings])
          .select();
        
        if (newError) throw newError;
        
        return newData[0];
      }
      
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error en getUserSavings:', error);
    throw error;
  }
}

export async function updateSavingsBalance(balance) {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    // Obtener el registro de ahorros del usuario
    const { data: savings, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (savingsError) throw savingsError;
    
    // Actualizar el saldo
    const { data, error } = await supabase
      .from('savings')
      .update({ balance })
      .eq('id', savings.id)
      .select();
    
    if (error) throw error;
    
    // Registrar en el historial
    const historyEntry = {
      id: uuidv4(),
      savings_id: savings.id,
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      type: 'Saldo Inicial',
      description: 'Configuración de saldo inicial',
      amount: balance,
      balance: balance
    };
    
    const { error: historyError } = await supabase
      .from('savings_history')
      .insert([historyEntry]);
    
    if (historyError) throw historyError;
    
    return data[0];
  } catch (error) {
    console.error('Error en updateSavingsBalance:', error);
    throw error;
  }
}

export async function getSavingsHistory() {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    // Obtener el registro de ahorros del usuario
    const { data: savings, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (savingsError) throw savingsError;
    
    // Obtener el historial
    const { data, error } = await supabase
      .from('savings_history')
      .select('*')
      .eq('savings_id', savings.id)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    // Convertir de snake_case a camelCase para mantener compatibilidad
    return data.map(h => ({
      id: h.id,
      savingsId: h.savings_id,
      userId: h.user_id,
      date: h.date,
      type: h.type,
      description: h.description,
      amount: h.amount,
      balance: h.balance
    }));
  } catch (error) {
    console.error('Error en getSavingsHistory:', error);
    throw error;
  }
}

async function updateSavingsFromTransaction(transaction) {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    // Obtener el registro de ahorros del usuario
    const { data: savings, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (savingsError) throw savingsError;
    
    // Calcular el nuevo saldo
    let newBalance = savings.balance;
    if (transaction.type === 'entrada') {
      newBalance += transaction.amount;
    } else {
      newBalance -= Math.abs(transaction.amount);
    }
    
    // Actualizar el saldo
    const { error: updateError } = await supabase
      .from('savings')
      .update({ balance: newBalance })
      .eq('id', savings.id);
    
    if (updateError) throw updateError;
    
    // Registrar en el historial
    const historyEntry = {
      id: uuidv4(),
      savings_id: savings.id,
      user_id: user.id,
      date: transaction.date,
      type: transaction.type === 'entrada' ? 'Ingreso' : 'Gasto',
      description: transaction.description,
      amount: transaction.type === 'entrada' ? transaction.amount : -Math.abs(transaction.amount),
      balance: newBalance
    };
    
    const { error: historyError } = await supabase
      .from('savings_history')
      .insert([historyEntry]);
    
    if (historyError) throw historyError;
    
    return newBalance;
  } catch (error) {
    console.error('Error en updateSavingsFromTransaction:', error);
    throw error;
  }
}

// Funciones para usuarios (users)
export async function getAllUsers() {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    // Obtener el perfil del usuario para verificar si es admin
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) throw profileError;
    
    // Si no es admin, solo devolver su propio perfil
    if (!profile.is_admin) {
      return [profile];
    }
    
    // Si es admin, obtener todos los usuarios de su equipo
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('team_id', profile.team_id);
    
    if (error) throw error;
    
    // Convertir de snake_case a camelCase para mantener compatibilidad
    return data.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      isAdmin: u.is_admin,
      teamId: u.team_id,
      teamName: u.team_name,
      teamCode: u.team_code
    }));
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    throw error;
  }
}

// Función para migrar datos de IndexedDB a Supabase
export async function migrateDataToSupabase(indexedDBData) {
  try {
    // 1. Migrar equipos
    if (indexedDBData.teams && indexedDBData.teams.length > 0) {
      for (const team of indexedDBData.teams) {
        const { error } = await supabase
          .from('teams')
          .insert([{
            id: team.id,
            name: team.name,
            code: team.code,
            password: team.password,
            created_by: team.createdBy
          }]);
        
        if (error && error.code !== '23505') { // Ignorar errores de duplicados
          console.error('Error al migrar equipo:', error);
        }
      }
    }
    
    // 2. Migrar usuarios
    if (indexedDBData.users && indexedDBData.users.length > 0) {
      for (const user of indexedDBData.users) {
        // Crear usuario en Auth
        const { error: authError } = await supabase.auth.admin.createUser({
          email: user.email,
          password: 'TemporaryPassword123!', // Contraseña temporal
          email_confirm: true,
          user_metadata: {
            username: user.username
          }
        });
        
        if (authError && authError.code !== '23505') {
          console.error('Error al crear usuario en Auth:', authError);
          continue;
        }
        
        // Obtener el ID del usuario recién creado
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();
        
        const userId = userData?.id || user.id;
        
        // Crear perfil de usuario
        const { error: profileError } = await supabase
          .from('users')
          .upsert([{
            id: userId,
            username: user.username,
            email: user.email,
            is_admin: user.isAdmin,
            team_id: user.teamId,
            team_name: user.teamName,
            team_code: user.teamCode
          }]);
        
        if (profileError) {
          console.error('Error al crear perfil de usuario:', profileError);
        }
      }
    }
    
    // 3. Migrar categorías
    if (indexedDBData.categories && indexedDBData.categories.length > 0) {
      for (const category of indexedDBData.categories) {
        const { error } = await supabase
          .from('categories')
          .insert([{
            name: category.name,
            color: category.color
          }]);
        
        if (error && error.code !== '23505') {
          console.error('Error al migrar categoría:', error);
        }
      }
    }
    
    // 4. Migrar transacciones
    if (indexedDBData.transactions && indexedDBData.transactions.length > 0) {
      for (const transaction of indexedDBData.transactions) {
        // Obtener el ID de usuario en Supabase
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', transaction.userEmail) // Asumiendo que tienes el email en la transacción
          .single();
        
        const userId = userData?.id || transaction.userId;
        
        const { error } = await supabase
          .from('transactions')
          .insert([{
            id: transaction.id,
            user_id: userId,
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
    if (indexedDBData.savings && indexedDBData.savings.length > 0) {
      for (const saving of indexedDBData.savings) {
        // Obtener el ID de usuario en Supabase
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', saving.userEmail) // Asumiendo que tienes el email en el ahorro
          .single();
        
        const userId = userData?.id || saving.userId;
        
        // Crear registro de ahorros
        const { data, error } = await supabase
          .from('savings')
          .insert([{
            id: saving.id,
            user_id: userId,
            balance: saving.balance
          }])
          .select();
        
        if (error && error.code !== '23505') {
          console.error('Error al migrar ahorros:', error);
          continue;
        }
        
        const savingsId = data?.[0]?.id || saving.id;
        
        // Migrar historial de ahorros
        if (saving.history && saving.history.length > 0) {
          for (const historyItem of saving.history) {
            const { error: historyError } = await supabase
              .from('savings_history')
              .insert([{
                id: uuidv4(),
                savings_id: savingsId,
                user_id: userId,
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

// Función para exportar datos de IndexedDB
export async function exportIndexedDBData(db) {
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
