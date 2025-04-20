// Supabase Service - Reemplazo para las funciones de IndexedDB
import { supabase } from './supabaseClient.js';

// Usar la función global de UUID en lugar de importar el módulo
const uuidv4 = window.uuidv4 || function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Funciones de autenticación
export async function signUp(email, password, username, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  try {
    // 1. Registrar el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          is_admin: isAdmin,
          team_id: teamId,
          team_name: teamName,
          team_code: teamCode
        }
      }
    });

    if (authError) throw authError;

    // 2. Crear el perfil del usuario en la tabla users
    const userId = authData.user.id;

    try {
      // Intentar con método estándar primero
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

      if (profileError) {
        console.error('Error al crear perfil de usuario con método estándar:', profileError);
        throw profileError;
      }
    } catch (profileError) {
      console.error('Error al crear perfil de usuario:', profileError);

      // Intentar con RPC como alternativa
      try {
        const { data: userData, error: userError } = await supabase.rpc('insert_user_directly', {
          user_id: userId,
          user_email: email,
          user_username: username,
          user_is_admin: isAdmin,
          user_team_id: teamId,
          user_team_name: teamName,
          user_team_code: teamCode
        });

        if (userError) {
          console.error('Error al crear perfil de usuario con RPC:', userError);

          // Intentar con SQL directo como última alternativa
          const { data: directData, error: directError } = await supabase.rpc('execute_sql', {
            sql_query: `INSERT INTO public.users (id, email, username, is_admin, team_id, team_name, team_code)
                      VALUES ('${userId}', '${email}', '${username}', ${isAdmin ? 'true' : 'false'},
                      ${teamId ? `'${teamId}'` : 'NULL'},
                      ${teamName ? `'${teamName}'` : 'NULL'},
                      ${teamCode ? `'${teamCode}'` : 'NULL'})
                      ON CONFLICT (id) DO UPDATE SET
                      email = EXCLUDED.email,
                      username = EXCLUDED.username,
                      is_admin = EXCLUDED.is_admin,
                      team_id = EXCLUDED.team_id,
                      team_name = EXCLUDED.team_name,
                      team_code = EXCLUDED.team_code
                      RETURNING to_json(users.*);`
          });

          if (directError) {
            console.error('Error al insertar usuario directamente:', directError);
            throw directError;
          }

          console.log('Usuario insertado directamente:', directData);
        } else {
          console.log('Usuario creado con RPC:', userData);
        }
      } catch (finalError) {
        console.error('Error final al crear perfil de usuario:', finalError);
        throw finalError;
      }
    }

    // 3. Crear un registro de ahorros para el usuario
    const savingsId = uuidv4();

    try {
      // Intentar con método estándar primero
      const { error: savingsError } = await supabase
        .from('savings')
        .insert([
          {
            id: savingsId,
            user_id: userId,
            balance: 0
          }
        ]);

      if (savingsError) {
        console.error('Error al crear ahorros con método estándar:', savingsError);
        throw savingsError;
      }
    } catch (savingsError) {
      console.error('Error al crear ahorros:', savingsError);

      // Intentar con RPC como alternativa
      try {
        const { data: savingsData, error: savingsRpcError } = await supabase.rpc('insert_savings_directly', {
          savings_id: savingsId,
          savings_user_id: userId,
          savings_balance: 0
        });

        if (savingsRpcError) {
          console.error('Error al crear ahorros con RPC:', savingsRpcError);

          // Intentar con SQL directo como última alternativa
          const { data: directSavingsData, error: directSavingsError } = await supabase.rpc('execute_sql', {
            sql_query: `INSERT INTO public.savings (id, user_id, balance)
                      VALUES ('${savingsId}', '${userId}', 0)
                      RETURNING to_json(savings.*);`
          });

          if (directSavingsError) {
            console.error('Error al insertar ahorros directamente:', directSavingsError);
            throw directSavingsError;
          }

          console.log('Ahorros insertados directamente:', directSavingsData);
        } else {
          console.log('Ahorros creados con RPC:', savingsData);
        }
      } catch (finalSavingsError) {
        console.error('Error final al crear ahorros:', finalSavingsError);
        throw finalSavingsError;
      }
    }

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
    console.log('Cerrando sesión en Supabase desde supabaseService...');

    // Limpiar suscripciones en tiempo real si existen
    if (typeof window.cleanupSubscriptions === 'function') {
      window.cleanupSubscriptions();
      console.log('Suscripciones en tiempo real limpiadas');
    }

    // Detener la recarga periódica si existe
    if (typeof window.stopPeriodicRefresh === 'function') {
      window.stopPeriodicRefresh();
      console.log('Recarga periódica detenida');
    }

    // Cerrar sesión en Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error al cerrar sesión en Supabase:', error);
      throw error;
    }

    console.log('Sesión cerrada correctamente en Supabase');
    return { success: true };
  } catch (error) {
    console.error('Error en signOut:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al cerrar sesión'
    };
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

    if (queryError) {
      console.error('Error al verificar equipos existentes:', queryError);
      // Continuar con un valor predeterminado
      existingTeams = [];
    }

    // Generar un código único
    let teamNumber = (existingTeams && existingTeams.length) ? existingTeams.length + 1 : 1;
    let isCodeUnique = false;
    let code = '';

    while (!isCodeUnique) {
      code = `${teamPrefix}-${teamNumber.toString().padStart(4, '0')}`;

      // Verificar si este código ya existe
      try {
        const { data: existingCode, error: codeError } = await supabase
          .from('teams')
          .select('id')
          .eq('code', code);

        if (codeError) {
          console.error('Error al verificar código existente:', codeError);
          // Incrementar el número y continuar
          teamNumber++;
          continue;
        }

        if (!existingCode || existingCode.length === 0) {
          isCodeUnique = true;
        } else {
          teamNumber++;
        }
      } catch (codeCheckError) {
        console.error('Error al verificar código:', codeCheckError);
        // Incrementar el número y continuar
        teamNumber++;
      }
    }

    // Intentar crear el equipo con SQL directo primero (esto debería evitar las restricciones RLS)
    try {
      const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
        sql_query: `INSERT INTO public.teams (id, name, code, password, created_by)
                  VALUES ('${id}', '${name}', '${code}', '${password}', '${createdBy}')
                  RETURNING to_json(teams.*);`
      });

      if (sqlError) {
        console.error('Error al crear equipo con SQL directo:', sqlError);
        throw sqlError;
      }

      console.log('Equipo creado con SQL directo:', sqlData);
      return sqlData;
    } catch (sqlError) {
      console.error('Error al crear equipo con SQL directo:', sqlError);

      // Intentar con la función RPC segura
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('insert_team_safely', {
          team_id: id,
          team_name: name,
          team_code: code,
          team_password: password,
          team_created_by: createdBy
        });

        if (rpcError) {
          console.error('Error al crear equipo con RPC:', rpcError);
          throw rpcError;
        }

        console.log('Equipo creado con RPC:', rpcData);
        return rpcData;
      } catch (rpcError) {
        console.error('Error al crear equipo con RPC:', rpcError);

        // Intentar con el método estándar como último recurso
        try {
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

          if (error) {
            console.error('Error al crear equipo con método estándar:', error);
            throw error;
          }

          console.log('Equipo creado con método estándar:', data);
          return data[0];
        } catch (standardError) {
          console.error('Error final al crear equipo:', standardError);
          throw standardError;
        }
      }
    }
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
    // Intentar con método estándar primero
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*');

      if (error) {
        console.error('Error al cargar equipos con método estándar:', error);
        throw error;
      }

      console.log('Equipos cargados con método estándar:', data);
      return data;
    } catch (error) {
      console.error('Error al cargar equipos con método estándar:', error);

      // Intentar con SQL directo como respaldo
      try {
        const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
          sql_query: `SELECT to_json(t.*) FROM public.teams t;`
        });

        if (sqlError) {
          console.error('Error al cargar equipos con SQL directo:', sqlError);
          throw sqlError;
        }

        console.log('Equipos cargados con SQL directo:', sqlData);
        return sqlData;
      } catch (sqlError) {
        console.error('Error al cargar equipos con SQL directo:', sqlError);

        // Último recurso: intentar con la función RPC get_all_teams
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_teams');

          if (rpcError) {
            console.error('Error al cargar equipos con RPC get_all_teams:', rpcError);
            throw rpcError;
          }

          console.log('Equipos cargados con RPC get_all_teams:', rpcData);
          return rpcData;
        } catch (rpcError) {
          console.error('Error al cargar equipos con RPC get_all_teams:', rpcError);
          throw rpcError;
        }
      }
    }
  } catch (error) {
    console.error('Error en getAllTeams:', error);
    // Devolver un array vacío en caso de error para evitar que la aplicación se rompa
    return [];
  }
}

// Funciones CRUD para transacciones (transactions)
export async function addTransaction(transaction) {
  try {
    console.log('Iniciando addTransaction con:', transaction);

    // Asegurarse de que la transacción tenga un ID
    if (!transaction.id) {
      transaction.id = uuidv4();
      console.log('ID generado para la transacción:', transaction.id);
    }

    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Error: Usuario no autenticado');
      throw new Error('Usuario no autenticado');
    }
    console.log('Usuario autenticado:', user.id);

    // Asignar el ID de usuario a la transacción
    transaction.user_id = user.id;

    // Convertir nombres de propiedades a snake_case para Supabase
    const supabaseTransaction = {
      id: transaction.id,
      user_id: transaction.user_id,
      type: transaction.type,
      cost_type: transaction.costType || transaction.cost_type,
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      description: transaction.description
    };

    console.log('Transacción preparada para Supabase:', supabaseTransaction);

    // Intentar con método estándar primero
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([supabaseTransaction])
        .select();

      if (error) {
        console.error('Error al insertar transacción con método estándar:', error);
        throw error;
      }

      console.log('Transacción insertada correctamente:', data[0]);
      return data[0];
    } catch (insertError) {
      console.error('Error al insertar transacción:', insertError);

      // Intentar con SQL directo como alternativa
      try {
        console.log('Intentando insertar transacción con SQL directo');
        const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
          sql_query: `INSERT INTO public.transactions (id, user_id, type, cost_type, amount, category, date, description)
                    VALUES ('${supabaseTransaction.id}', '${supabaseTransaction.user_id}', '${supabaseTransaction.type}',
                    '${supabaseTransaction.cost_type || 'variable'}', ${supabaseTransaction.amount}, '${supabaseTransaction.category}',
                    '${supabaseTransaction.date}', '${supabaseTransaction.description.replace(/'/g, "''")}')
                    RETURNING to_json(transactions.*);`
        });

        if (sqlError) {
          console.error('Error al insertar transacción con SQL directo:', sqlError);
          throw sqlError;
        }

        console.log('Transacción insertada con SQL directo:', sqlData);
        return sqlData;
      } catch (sqlError) {
        console.error('Error final al insertar transacción:', sqlError);
        throw sqlError;
      }
    }
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

export async function getTransactionById(id) {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Convertir de snake_case a camelCase para mantener compatibilidad
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      costType: data.cost_type,
      amount: data.amount,
      category: data.category,
      date: data.date,
      description: data.description
    };
  } catch (error) {
    console.error('Error en getTransactionById:', error);
    throw error;
  }
}

// Funciones CRUD para categorías (categories)
export async function addCategory(category) {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Preparar la categoría para Supabase
    const supabaseCategory = {
      name: category.name,
      color: category.color,
      user_id: user.id
    };

    const { data, error } = await supabase
      .from('categories')
      .insert([supabaseCategory])
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
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Preparar la categoría para Supabase
    const supabaseCategory = {
      name: category.name,
      color: category.color
    };

    // Actualizar la categoría del usuario
    const { data, error } = await supabase
      .from('categories')
      .update(supabaseCategory)
      .eq('name', category.originalName || category.name)
      .eq('user_id', user.id)
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
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Eliminar la categoría del usuario
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('name', name)
      .eq('user_id', user.id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error en deleteCategory:', error);
    throw error;
  }
}

export async function getAllCategories() {
  try {
    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Obtener categorías del usuario
    const { data: userCategories, error: userError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    if (userError) throw userError;

    // Obtener categorías globales (sin user_id)
    const { data: globalCategories, error: globalError } = await supabase
      .from('categories')
      .select('*')
      .is('user_id', null);

    if (globalError) throw globalError;

    // Combinar categorías
    const allCategories = [...(globalCategories || []), ...(userCategories || [])];

    return allCategories;
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

    // Verificar si ya existe una entrada para esta fecha y tipo (normalizado)
    const transactionType = transaction.type === 'entrada' ? 'ingreso' : 'gasto';
    const { data: existingEntries, error: checkError } = await supabase
      .from('savings_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', transaction.date)
      .or(`type.ilike.${transactionType},type.ilike.${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}`);

    if (checkError) {
      console.error('Error al verificar entradas existentes:', checkError);
      // Continuar con la inserción aunque haya error en la verificación
    } else if (existingEntries && existingEntries.length > 0) {
      console.log('Ya existe una entrada para esta fecha y tipo. Actualizando en lugar de insertar.');

      // Actualizar la entrada existente más reciente
      const latestEntry = existingEntries.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      )[0];

      const { error: updateHistoryError } = await supabase
        .from('savings_history')
        .update({
          description: transaction.description,
          amount: transaction.type === 'entrada' ? transaction.amount : -Math.abs(transaction.amount),
          balance: newBalance
        })
        .eq('id', latestEntry.id);

      if (updateHistoryError) {
        console.error('Error al actualizar historial existente:', updateHistoryError);
        // Continuar con la inserción si falla la actualización
      } else {
        return newBalance; // Salir si la actualización fue exitosa
      }
    }

    // Si no existe o hubo error en la verificación/actualización, insertar nueva entrada
    const historyEntry = {
      id: uuidv4(),
      savings_id: savings.id,
      user_id: user.id,
      date: transaction.date,
      type: transaction.type === 'entrada' ? 'ingreso' : 'gasto', // Usar minúsculas para consistencia
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
    console.log('Obteniendo todos los usuarios del equipo desde Supabase...');

    // Obtener el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Error: Usuario no autenticado');
      throw new Error('Usuario no autenticado');
    }

    console.log('Usuario autenticado:', user.id);

    // Obtener el perfil del usuario para obtener el ID del equipo
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error al obtener perfil del usuario:', profileError);
      throw profileError;
    }

    console.log('Perfil del usuario obtenido:', profile);

    if (!profile.team_id) {
      console.log('El usuario no pertenece a ningún equipo, devolviendo solo su perfil');
      return [profile];
    }

    console.log('Obteniendo usuarios del equipo:', profile.team_id);

    // Obtener todos los usuarios del mismo equipo
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

// Función para cargar el perfil de otro usuario
export async function loadUserProfile(userId) {
  try {
    console.log('Cargando perfil de usuario desde supabaseService:', userId);

    // Verificar que el usuario pertenezca al mismo equipo
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // Obtener el perfil del usuario actual
    const { data: currentUserProfile, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (currentUserError) {
      console.error('Error al obtener perfil del usuario actual:', currentUserError);
      throw new Error('No se pudo obtener el perfil del usuario actual');
    }

    // Obtener el perfil del usuario objetivo
    const { data: targetUserProfile, error: targetUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (targetUserError) {
      console.error('Error al obtener perfil del usuario objetivo:', targetUserError);
      throw new Error('Usuario no encontrado');
    }

    // Verificar que ambos usuarios pertenezcan al mismo equipo
    if (targetUserProfile.team_id !== currentUserProfile.team_id) {
      throw new Error('Solo puede cargar perfiles de usuarios de su mismo equipo');
    }

    // Guardar el ID del usuario objetivo para usarlo en las funciones de filtrado
    // Esto es crucial para que las funciones de filtrado usen el ID correcto
    const targetUserId = targetUserProfile.id;
    console.log('ID del usuario objetivo guardado para filtrado:', targetUserId);

    // 1. Cargar transacciones del usuario objetivo
    const { data: targetTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId);

    if (transactionsError) {
      console.error('Error al cargar transacciones del usuario objetivo:', transactionsError);
      throw new Error('No se pudieron cargar las transacciones');
    }

    // Clonar las transacciones para el usuario actual
    for (const transaction of targetTransactions) {
      if (transaction.type !== 'tir_project') {
        const newTransaction = {
          type: transaction.type,
          amount: transaction.amount,
          category: transaction.category,
          date: transaction.date,
          description: transaction.description,
          cost_type: transaction.cost_type || '',
          user_id: user.id
        };

        const { data, error } = await supabase
          .from('transactions')
          .insert([newTransaction]);

        if (error) {
          console.error('Error al clonar transacción:', error);
        }
      }
    }

    // 2. Cargar ahorros del usuario objetivo
    const { data: targetSavings, error: savingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (savingsError && savingsError.code !== 'PGRST116') { // Ignorar error si no hay registros
      console.error('Error al cargar ahorros del usuario objetivo:', savingsError);
      throw new Error('No se pudieron cargar los ahorros');
    }

    // 3. Cargar historial de ahorros del usuario objetivo
    const { data: targetSavingsHistory, error: historyError } = await supabase
      .from('savings_history')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (historyError) {
      console.error('Error al cargar historial de ahorros del usuario objetivo:', historyError);
      throw new Error('No se pudo cargar el historial de ahorros');
    }

    // Actualizar los ahorros del usuario actual
    if (targetSavings) {
      // Eliminar registros existentes de ahorros
      const { error: deleteError } = await supabase
        .from('savings')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error al eliminar ahorros existentes:', deleteError);
      }

      // Crear nuevo registro de ahorros
      const { error: insertError } = await supabase
        .from('savings')
        .insert([{
          balance: targetSavings.balance,
          user_id: user.id
        }]);

      if (insertError) {
        console.error('Error al insertar nuevos ahorros:', insertError);
      }
    }

    // Actualizar el historial de ahorros del usuario actual
    if (targetSavingsHistory && targetSavingsHistory.length > 0) {
      // Eliminar registros existentes del historial
      const { error: deleteHistoryError } = await supabase
        .from('savings_history')
        .delete()
        .eq('user_id', user.id);

      if (deleteHistoryError) {
        console.error('Error al eliminar historial existente:', deleteHistoryError);
      }

      // Crear nuevos registros de historial
      const newHistoryEntries = targetSavingsHistory.map(entry => ({
        date: entry.date,
        type: entry.type,
        amount: entry.amount,
        balance: entry.balance,
        description: entry.description,
        user_id: user.id
      }));

      for (const entry of newHistoryEntries) {
        const { error: insertHistoryError } = await supabase
          .from('savings_history')
          .insert([entry]);

        if (insertHistoryError) {
          console.error('Error al insertar entrada de historial:', insertHistoryError);
        }
      }
    }

    // Cargar las transacciones actualizadas - IMPORTANTE: Usar targetUserId para cargar los datos del usuario objetivo
    const { data: updatedTransactions, error: updatedTransactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', targetUserId); // Usar el ID del usuario objetivo

    if (updatedTransactionsError) {
      console.error('Error al cargar transacciones actualizadas:', updatedTransactionsError);
      // Establecer un valor predeterminado para evitar errores
      window.transactions = [];
    } else {
      // Convertir de snake_case a camelCase para mantener compatibilidad
      window.transactions = updatedTransactions.map(t => ({
        id: t.id,
        userId: targetUserId, // Usar el ID del usuario objetivo
        user_id: targetUserId, // Usar el ID del usuario objetivo
        type: t.type,
        costType: t.cost_type,
        cost_type: t.cost_type,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description
      }));

      console.log('Transacciones actualizadas cargadas:', window.transactions.length);
      console.log('Muestra de transacciones:', window.transactions.slice(0, 2));
    }

    // Cargar los ahorros actualizados - IMPORTANTE: Usar targetUserId para cargar los datos del usuario objetivo
    const { data: updatedSavings, error: updatedSavingsError } = await supabase
      .from('savings')
      .select('*')
      .eq('user_id', targetUserId) // Usar el ID del usuario objetivo
      .single();

    if (updatedSavingsError && updatedSavingsError.code !== 'PGRST116') {
      console.error('Error al cargar ahorros actualizados:', updatedSavingsError);
      // Establecer un valor predeterminado para evitar errores
      window.savingsBalance = 0;
    } else if (updatedSavings) {
      window.savingsBalance = updatedSavings.balance;
      console.log('Balance de ahorros actualizado:', window.savingsBalance);
    } else {
      // Si no hay ahorros, establecer un valor predeterminado
      window.savingsBalance = 0;
      console.log('No se encontraron ahorros, estableciendo balance a 0');
    }

    // Cargar el historial de ahorros actualizado - IMPORTANTE: Usar targetUserId para cargar los datos del usuario objetivo
    const { data: updatedSavingsHistory, error: updatedHistoryError } = await supabase
      .from('savings_history')
      .select('*')
      .eq('user_id', targetUserId) // Usar el ID del usuario objetivo
      .order('date', { ascending: true });

    if (updatedHistoryError) {
      console.error('Error al cargar historial de ahorros actualizado:', updatedHistoryError);
      // Establecer un valor predeterminado para evitar errores
      window.savingsHistory = [];
    } else {
      // Convertir de snake_case a camelCase para mantener compatibilidad
      window.savingsHistory = updatedSavingsHistory.map(h => ({
        id: h.id,
        userId: targetUserId, // Usar el ID del usuario objetivo
        user_id: targetUserId, // Usar el ID del usuario objetivo
        date: h.date,
        type: h.type,
        amount: h.amount,
        balance: h.balance,
        description: h.description
      }));

      console.log('Historial de ahorros actualizado cargado:', window.savingsHistory.length);
      console.log('Muestra de historial:', window.savingsHistory.slice(0, 2));
    }

    // Actualizar el ID de usuario en la sesión para que las funciones de filtrado funcionen correctamente
    // IMPORTANTE: Usar targetUserId para que las funciones de filtrado usen el ID correcto
    sessionStorage.setItem('userId', targetUserId);
    console.log('ID de usuario actualizado en la sesión:', targetUserId);

    console.log('Perfil cargado correctamente');
    return true;
  } catch (error) {
    console.error('Error en loadUserProfile:', error);
    throw error;
  }
}

// Exponer las funciones globalmente
window.supabaseService = {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  createTeam,
  getTeamByCode,
  getAllTeams,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactions,
  getTransactionById,
  addSavingsEntry,
  getSavingsBalance,
  getSavingsHistory,
  loadUserProfile
};

// Exportar para uso en módulos
export default {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  createTeam,
  getTeamByCode,
  getAllTeams,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactions,
  getTransactionById,
  addSavingsEntry,
  getSavingsBalance,
  getSavingsHistory,
  loadUserProfile
};
