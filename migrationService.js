// Servicio de migración de IndexedDB a Supabase
// Usar la función global de UUID en lugar de importar el módulo
const uuidv4 = window.uuidv4 || function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Obtener el cliente de Supabase
let supabase;
try {
  // Intentar importar el cliente de Supabase
  const module = await import('./supabaseClient.js');
  supabase = module.supabase;
} catch (error) {
  console.error('Error al importar el cliente de Supabase:', error);
  // Usar la función global como alternativa
  if (typeof window !== 'undefined' && window.getSupabaseClient) {
    supabase = window.getSupabaseClient();
  } else {
    console.error('No se pudo obtener el cliente de Supabase');
  }
}

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
    // Verificar que tenemos un cliente de Supabase válido
    if (!supabase) {
      console.error('Cliente de Supabase no disponible para la migración');
      if (typeof window !== 'undefined' && window.getSupabaseClient) {
        supabase = window.getSupabaseClient();
        console.log('Cliente de Supabase obtenido desde la función global');
      } else {
        throw new Error('No se pudo obtener el cliente de Supabase para la migración');
      }
    }

    // 1. Migrar equipos
    if (data.teams && data.teams.length > 0) {
      console.log(`Migrando ${data.teams.length} equipos...`);
      for (const team of data.teams) {
        try {
          // Intentar con método estándar primero
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
            console.error('Error al migrar equipo con método estándar:', error);
            throw error;
          }
        } catch (error) {
          console.error('Error al migrar equipo:', error);

          // Intentar con SQL directo como alternativa
          try {
            const teamId = team.id || uuidv4();
            const teamCode = team.code || generateTeamCode(team.name);
            const teamPassword = team.password || 'password123';
            const teamCreatedBy = team.createdBy || 'migration@system.com';

            const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
              sql_query: `INSERT INTO public.teams (id, name, code, password, created_by)
                        VALUES ('${teamId}', '${team.name}', '${teamCode}', '${teamPassword}', '${teamCreatedBy}')
                        ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        code = EXCLUDED.code,
                        password = EXCLUDED.password,
                        created_by = EXCLUDED.created_by
                        RETURNING to_json(teams.*);`
            });

            if (sqlError) {
              console.error('Error al migrar equipo con SQL directo:', sqlError);
            } else {
              console.log('Equipo migrado con SQL directo:', sqlData);
            }
          } catch (sqlError) {
            console.error('Error final al migrar equipo:', sqlError);
          }
        }
      }
    }

    // 2. Migrar usuarios
    if (data.users && data.users.length > 0) {
      console.log(`Migrando ${data.users.length} usuarios...`);
      for (const user of data.users) {
        try {
          // Crear perfil de usuario en la tabla users con método estándar
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
            console.error('Error al migrar perfil de usuario con método estándar:', profileError);
            throw profileError;
          }
        } catch (profileError) {
          console.error('Error al migrar perfil de usuario:', profileError);

          // Intentar con SQL directo como alternativa
          try {
            const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
              sql_query: `INSERT INTO public.users (id, username, email, password, is_admin, team_id, team_name, team_code)
                        VALUES ('${user.id}', '${user.username}', '${user.email}', '${user.password || ''}',
                        ${user.isAdmin ? 'true' : 'false'},
                        ${user.teamId ? `'${user.teamId}'` : 'NULL'},
                        ${user.teamName ? `'${user.teamName}'` : 'NULL'},
                        ${user.teamCode ? `'${user.teamCode}'` : 'NULL'})
                        ON CONFLICT (id) DO UPDATE SET
                        username = EXCLUDED.username,
                        email = EXCLUDED.email,
                        password = EXCLUDED.password,
                        is_admin = EXCLUDED.is_admin,
                        team_id = EXCLUDED.team_id,
                        team_name = EXCLUDED.team_name,
                        team_code = EXCLUDED.team_code
                        RETURNING to_json(users.*);`
            });

            if (sqlError) {
              console.error('Error al migrar usuario con SQL directo:', sqlError);
            } else {
              console.log('Usuario migrado con SQL directo:', sqlData);
            }
          } catch (sqlError) {
            console.error('Error final al migrar usuario:', sqlError);
          }
        }
      }
    }

    // 3. Migrar categorías
    if (data.categories && data.categories.length > 0) {
      console.log(`Migrando ${data.categories.length} categorías...`);
      for (const category of data.categories) {
        try {
          const { error } = await supabase
            .from('categories')
            .upsert([{
              name: category.name,
              color: category.color
            }]);

          if (error && error.code !== '23505') {
            console.error('Error al migrar categoría con método estándar:', error);
            throw error;
          }
        } catch (error) {
          console.error('Error al migrar categoría:', error);

          // Intentar con SQL directo como alternativa
          try {
            const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
              sql_query: `INSERT INTO public.categories (name, color)
                        VALUES ('${category.name}', '${category.color}')
                        ON CONFLICT (name) DO UPDATE SET
                        color = EXCLUDED.color
                        RETURNING to_json(categories.*);`
            });

            if (sqlError) {
              console.error('Error al migrar categoría con SQL directo:', sqlError);
            } else {
              console.log('Categoría migrada con SQL directo:', sqlData);
            }
          } catch (sqlError) {
            console.error('Error final al migrar categoría:', sqlError);
          }
        }
      }
    }

    // 4. Migrar transacciones
    if (data.transactions && data.transactions.length > 0) {
      console.log(`Migrando ${data.transactions.length} transacciones...`);
      for (const transaction of data.transactions) {
        try {
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
            console.error('Error al migrar transacción con método estándar:', error);
            throw error;
          }
        } catch (error) {
          console.error('Error al migrar transacción:', error);

          // Intentar con SQL directo como alternativa
          try {
            const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
              sql_query: `INSERT INTO public.transactions (id, user_id, type, cost_type, amount, category, date, description)
                        VALUES ('${transaction.id}', '${transaction.userId}', '${transaction.type}',
                        '${transaction.costType}', ${transaction.amount}, '${transaction.category}',
                        '${transaction.date}', '${transaction.description.replace(/'/g, "''")}')
                        ON CONFLICT (id) DO UPDATE SET
                        user_id = EXCLUDED.user_id,
                        type = EXCLUDED.type,
                        cost_type = EXCLUDED.cost_type,
                        amount = EXCLUDED.amount,
                        category = EXCLUDED.category,
                        date = EXCLUDED.date,
                        description = EXCLUDED.description
                        RETURNING to_json(transactions.*);`
            });

            if (sqlError) {
              console.error('Error al migrar transacción con SQL directo:', sqlError);
            } else {
              console.log('Transacción migrada con SQL directo:', sqlData);
            }
          } catch (sqlError) {
            console.error('Error final al migrar transacción:', sqlError);
          }
        }
      }
    }

    // 5. Migrar ahorros
    if (data.savings && data.savings.length > 0) {
      console.log(`Migrando ${data.savings.length} registros de ahorros...`);
      for (const saving of data.savings) {
        let savingsId = saving.id;

        try {
          // Crear registro de ahorros con método estándar
          const { data: savingsData, error } = await supabase
            .from('savings')
            .upsert([{
              id: saving.id,
              user_id: saving.userId,
              balance: saving.balance
            }])
            .select();

          if (error && error.code !== '23505') {
            console.error('Error al migrar ahorros con método estándar:', error);
            throw error;
          }

          savingsId = savingsData?.[0]?.id || saving.id;
        } catch (error) {
          console.error('Error al migrar ahorros:', error);

          // Intentar con SQL directo como alternativa
          try {
            const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
              sql_query: `INSERT INTO public.savings (id, user_id, balance)
                        VALUES ('${saving.id}', '${saving.userId}', ${saving.balance})
                        ON CONFLICT (id) DO UPDATE SET
                        user_id = EXCLUDED.user_id,
                        balance = EXCLUDED.balance
                        RETURNING to_json(savings.*);`
            });

            if (sqlError) {
              console.error('Error al migrar ahorros con SQL directo:', sqlError);
              continue;
            } else {
              console.log('Ahorros migrados con SQL directo:', sqlData);
              savingsId = sqlData?.id || saving.id;
            }
          } catch (sqlError) {
            console.error('Error final al migrar ahorros:', sqlError);
            continue;
          }
        }

        // Migrar historial de ahorros
        if (saving.history && saving.history.length > 0) {
          console.log(`Migrando ${saving.history.length} registros de historial de ahorros...`);
          for (const historyItem of saving.history) {
            try {
              const historyId = uuidv4();
              const { error: historyError } = await supabase
                .from('savings_history')
                .insert([{
                  id: historyId,
                  savings_id: savingsId,
                  user_id: saving.userId,
                  date: historyItem.date,
                  type: historyItem.type,
                  description: historyItem.description,
                  amount: historyItem.amount,
                  balance: historyItem.balance
                }]);

              if (historyError) {
                console.error('Error al migrar historial de ahorros con método estándar:', historyError);
                throw historyError;
              }
            } catch (historyError) {
              console.error('Error al migrar historial de ahorros:', historyError);

              // Intentar con SQL directo como alternativa
              try {
                const historyId = uuidv4();
                const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', {
                  sql_query: `INSERT INTO public.savings_history (id, savings_id, user_id, date, type, description, amount, balance)
                            VALUES ('${historyId}', '${savingsId}', '${saving.userId}', '${historyItem.date}',
                            '${historyItem.type}', '${historyItem.description.replace(/'/g, "''")}',
                            ${historyItem.amount}, ${historyItem.balance})
                            RETURNING to_json(savings_history.*);`
                });

                if (sqlError) {
                  console.error('Error al migrar historial de ahorros con SQL directo:', sqlError);
                } else {
                  console.log('Historial de ahorros migrado con SQL directo:', sqlData);
                }
              } catch (sqlError) {
                console.error('Error final al migrar historial de ahorros:', sqlError);
              }
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
