// Supabase Service - Versión no modular

// Función para generar UUIDs
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Funciones de autenticación
async function signUp(email, password, username, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  try {
    console.log('¿Usar Supabase para registro?', isUsingSupabase());

    if (isUsingSupabase()) {
      // 1. Registrar el usuario en Supabase Auth
      const { data: authData, error: authError } = await getSupabaseClient().auth.signUp({
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
        const { error: profileError } = await getSupabaseClient()
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
          const { data: userData, error: userError } = await getSupabaseClient().rpc('insert_user_directly', {
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
            const { data: directData, error: directError } = await getSupabaseClient().rpc('execute_sql', {
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
        const { error: savingsError } = await getSupabaseClient()
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
          const { data: savingsData, error: savingsRpcError } = await getSupabaseClient().rpc('insert_savings_directly', {
            savings_id: savingsId,
            savings_user_id: userId,
            savings_balance: 0
          });

          if (savingsRpcError) {
            console.error('Error al crear ahorros con RPC:', savingsRpcError);

            // Intentar con SQL directo como última alternativa
            const { data: directSavingsData, error: directSavingsError } = await getSupabaseClient().rpc('execute_sql', {
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
    } else {
      // Usar IndexedDB para el registro
      console.log('Registrando usuario en IndexedDB...');
      return await window.registerUser(username, password, email, isAdmin, teamId, teamName, teamCode);
    }
  } catch (error) {
    console.error('Error en signUp:', error);
    throw error;
  }
}

async function signIn(email, password) {
  try {
    console.log('¿Usar Supabase para inicio de sesión?', isUsingSupabase());

    if (isUsingSupabase()) {
      try {
        const { data, error } = await getSupabaseClient().auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Obtener el perfil del usuario con método estándar
        try {
          const { data: profile, error: profileError } = await getSupabaseClient()
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.error('Error al obtener perfil de usuario con método estándar:', profileError);
            throw profileError;
          }

          return { user: data.user, profile };
        } catch (profileError) {
          console.error('Error al obtener perfil de usuario:', profileError);

          // Intentar con SQL directo como alternativa
          try {
            const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
              sql_query: `SELECT to_json(u.*) FROM public.users u WHERE id = '${data.user.id}';`
            });

            if (sqlError) {
              console.error('Error al obtener perfil de usuario con SQL directo:', sqlError);
              throw sqlError;
            }

            console.log('Perfil de usuario obtenido con SQL directo:', sqlData);
            return { user: data.user, profile: sqlData };
          } catch (sqlError) {
            console.error('Error final al obtener perfil de usuario:', sqlError);
            // Devolver solo la información del usuario sin perfil como último recurso
            return { user: data.user, profile: { id: data.user.id, email: data.user.email } };
          }
        }
      } catch (authError) {
        console.error('Error en la autenticación con Supabase:', authError);

        // Intentar obtener el usuario por email como alternativa
        try {
          const { data: userData, error: userError } = await getSupabaseClient().rpc('execute_sql', {
            sql_query: `SELECT to_json(u.*) FROM public.users u WHERE email = '${email}';`
          });

          if (userError || !userData) {
            console.error('Error al obtener usuario por email:', userError);
            throw userError || new Error('Usuario no encontrado');
          }

          // Verificar la contraseña (esto es solo para compatibilidad, no es seguro)
          if (userData.password !== password) {
            throw new Error('Contraseña incorrecta');
          }

          console.log('Usuario autenticado con método alternativo:', userData);
          return { user: { id: userData.id, email: userData.email }, profile: userData };
        } catch (finalError) {
          console.error('Error final en la autenticación:', finalError);
          throw finalError;
        }
      }
    } else {
      // Usar IndexedDB para el inicio de sesión
      console.log('Iniciando sesión en IndexedDB...');
      return await window.loginUser(email, password);
    }
  } catch (error) {
    console.error('Error en signIn:', error);
    throw error;
  }
}

async function signOut() {
  try {
    if (isUsingSupabase()) {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      return true;
    } else {
      // Usar IndexedDB para cerrar sesión
      sessionStorage.removeItem('userId');
      sessionStorage.removeItem('isAdmin');
      return true;
    }
  } catch (error) {
    console.error('Error en signOut:', error);
    throw error;
  }
}

async function getCurrentUser() {
  try {
    if (isUsingSupabase()) {
      try {
        const { data: { user }, error } = await getSupabaseClient().auth.getUser();

        if (error) throw error;
        if (!user) return null;

        // Obtener el perfil del usuario con método estándar
        try {
          const { data: profile, error: profileError } = await getSupabaseClient()
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.error('Error al obtener perfil de usuario con método estándar:', profileError);
            throw profileError;
          }

          return { user, profile };
        } catch (profileError) {
          console.error('Error al obtener perfil de usuario:', profileError);

          // Intentar con SQL directo como alternativa
          try {
            const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
              sql_query: `SELECT to_json(u.*) FROM public.users u WHERE id = '${user.id}';`
            });

            if (sqlError) {
              console.error('Error al obtener perfil de usuario con SQL directo:', sqlError);
              throw sqlError;
            }

            console.log('Perfil de usuario obtenido con SQL directo:', sqlData);
            return { user, profile: sqlData };
          } catch (sqlError) {
            console.error('Error final al obtener perfil de usuario:', sqlError);
            // Devolver solo la información del usuario sin perfil como último recurso
            return { user, profile: { id: user.id, email: user.email } };
          }
        }
      } catch (authError) {
        console.error('Error al obtener usuario actual de Supabase Auth:', authError);

        // Intentar obtener el usuario de la sesión local como alternativa
        const userId = sessionStorage.getItem('supabaseUserId');
        if (!userId) {
          console.log('No hay usuario en la sesión local');
          return null;
        }

        try {
          const { data: userData, error: userError } = await getSupabaseClient().rpc('execute_sql', {
            sql_query: `SELECT to_json(u.*) FROM public.users u WHERE id = '${userId}';`
          });

          if (userError || !userData) {
            console.error('Error al obtener usuario por ID de sesión:', userError);
            return null;
          }

          console.log('Usuario obtenido con método alternativo:', userData);
          return { user: { id: userData.id, email: userData.email }, profile: userData };
        } catch (finalError) {
          console.error('Error final al obtener usuario actual:', finalError);
          return null;
        }
      }
    } else {
      // Usar IndexedDB para obtener el usuario actual
      const userId = sessionStorage.getItem('userId');
      if (!userId) return null;

      const user = await window.getFromDb('users', userId);
      return user ? { user, profile: user } : null;
    }
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    return null;
  }
}

// Función para crear un equipo
async function createTeam(name, password, createdBy) {
  try {
    if (isUsingSupabase()) {
      const id = uuidv4();

      // Generar código de equipo
      const teamPrefix = name.substring(0, 4).toUpperCase();

      // Verificar si ya existe un equipo con el mismo nombre
      try {
        const { data: existingTeams, error: queryError } = await getSupabaseClient()
          .from('teams')
          .select('code')
          .ilike('name', name);

        if (queryError) {
          console.error('Error al verificar equipos existentes:', queryError);
          throw queryError;
        }

        // Generar un código único
        let teamNumber = (existingTeams && existingTeams.length) ? existingTeams.length + 1 : 1;
        let isCodeUnique = false;
        let code = '';

        while (!isCodeUnique) {
          code = `${teamPrefix}-${teamNumber.toString().padStart(4, '0')}`;

          // Verificar si este código ya existe
          try {
            const { data: existingCode, error: codeError } = await getSupabaseClient()
              .from('teams')
              .select('id')
              .eq('code', code);

            if (codeError) {
              console.error('Error al verificar código existente:', codeError);
              throw codeError;
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
          const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
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
            const { data: rpcData, error: rpcError } = await getSupabaseClient().rpc('insert_team_safely', {
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
              const { data, error } = await getSupabaseClient()
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
    } else {
      // Usar IndexedDB para crear el equipo
      console.log('Creando equipo en IndexedDB...');
      return await window.createTeam(name, password, createdBy);
    }
  } catch (error) {
    console.error('Error en createTeam:', error);
    throw error;
  }
}

// Función para obtener todos los equipos
async function getAllTeams() {
  try {
    if (isUsingSupabase()) {
      // Intentar con método estándar primero
      try {
        const { data, error } = await getSupabaseClient()
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
          const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
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
            const { data: rpcData, error: rpcError } = await getSupabaseClient().rpc('get_all_teams');

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
    } else {
      // Usar IndexedDB para obtener los equipos
      console.log('Obteniendo equipos de IndexedDB...');
      return await window.getAllTeams();
    }
  } catch (error) {
    console.error('Error en getAllTeams:', error);
    // Devolver un array vacío en caso de error para evitar que la aplicación se rompa
    return [];
  }
}

// Función para agregar una transacción
async function addTransaction(transaction) {
  try {
    if (isUsingSupabase()) {
      console.log('Iniciando addTransaction con:', transaction);

      // Asegurarse de que la transacción tenga un ID
      if (!transaction.id) {
        transaction.id = uuidv4();
        console.log('ID generado para la transacción:', transaction.id);
      }

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
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
        const { data, error } = await getSupabaseClient()
          .from('transactions')
          .insert([supabaseTransaction])
          .select();

        if (error) {
          console.error('Error al insertar transacción con método estándar:', error);
          throw error;
        }

        console.log('Transacción insertada correctamente:', data[0]);
        // No actualizar el saldo de ahorros aquí para evitar duplicados
        // La actualización se hace a través del trigger SQL
        return data[0];
      } catch (insertError) {
        console.error('Error al insertar transacción:', insertError);

        // Intentar con SQL directo como alternativa
        try {
          console.log('Intentando insertar transacción con SQL directo');
          const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
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
          // No actualizar el saldo de ahorros aquí para evitar duplicados
          // La actualización se hace a través del trigger SQL
          return sqlData;
        } catch (sqlError) {
          console.error('Error final al insertar transacción:', sqlError);
          throw sqlError;
        }
      }
    } else {
      // Usar IndexedDB para agregar la transacción
      return await window.addToDb('transactions', transaction);
    }
  } catch (error) {
    console.error('Error en addTransaction:', error);
    throw error;
  }
}

// Función para actualizar el saldo de ahorros desde una transacción
async function updateSavingsFromTransaction(transaction) {
  try {
    if (isUsingSupabase()) {
      console.log('Actualizando ahorros en Supabase para la transacción:', transaction);

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      console.log('Usuario autenticado para actualizar ahorros:', user.id);

      // Verificar si el usuario tiene un registro de ahorros
      const { data: savingsData, error: savingsQueryError } = await getSupabaseClient()
        .from('savings')
        .select('*')
        .eq('user_id', user.id);

      if (savingsQueryError) {
        console.error('Error al consultar ahorros:', savingsQueryError);
        throw savingsQueryError;
      }

      console.log('Registros de ahorros encontrados:', savingsData ? savingsData.length : 0);

      let savings;
      let newBalance;

      // Si no hay registro de ahorros, crear uno nuevo
      if (!savingsData || savingsData.length === 0) {
        console.log('No se encontró registro de ahorros, creando uno nuevo...');

        // Calcular el saldo inicial basado en la transacción
        newBalance = transaction.type === 'entrada' ? transaction.amount : -Math.abs(transaction.amount);

        // Crear un nuevo registro de ahorros
        const savingsId = uuidv4();
        console.log('Nuevo ID de ahorros generado:', savingsId);

        const { data: newSavings, error: insertError } = await getSupabaseClient()
          .from('savings')
          .insert({
            id: savingsId,
            user_id: user.id,
            balance: newBalance,
            created_at: new Date().toISOString()
          })
          .select();

        if (insertError) {
          console.error('Error al crear registro de ahorros:', insertError);
          throw insertError;
        }

        console.log('Nuevo registro de ahorros creado:', newSavings);
        savings = newSavings[0];
      } else {
        // Usar el registro existente
        savings = savingsData[0];
        console.log('Registro de ahorros existente:', savings);

        // Calcular el nuevo saldo
        newBalance = savings.balance;
        if (transaction.type === 'entrada' || transaction.type === 'entrada') {
          newBalance += transaction.amount;
        } else {
          newBalance -= Math.abs(transaction.amount);
        }

        console.log('Nuevo saldo calculado:', newBalance);

        // Actualizar el saldo
        const { error: updateError } = await getSupabaseClient()
          .from('savings')
          .update({ balance: newBalance })
          .eq('id', savings.id);

        if (updateError) {
          console.error('Error al actualizar saldo:', updateError);
          throw updateError;
        }

        console.log('Saldo actualizado correctamente');
      }

      // Registrar en el historial
      const historyId = uuidv4();
      console.log('Nuevo ID de historial generado:', historyId);

      const historyEntry = {
        id: historyId,
        savings_id: savings.id,
        user_id: user.id,
        date: transaction.date,
        type: transaction.type === 'entrada' ? 'Ingreso' : 'Gasto',
        description: transaction.description,
        amount: transaction.type === 'entrada' ? transaction.amount : -Math.abs(transaction.amount),
        balance: newBalance
      };

      console.log('Entrada de historial preparada:', historyEntry);

      const { error: historyError } = await getSupabaseClient()
        .from('savings_history')
        .insert([historyEntry]);

      if (historyError) {
        console.error('Error al guardar historial de ahorros:', historyError);
        throw historyError;
      }

      console.log('Historial de ahorros guardado correctamente');

      return newBalance;
    } else {
      // Usar la función original de IndexedDB
      console.log('Usando IndexedDB para actualizar ahorros');
      return await window.updateSavingsFromTransaction(transaction);
    }
  } catch (error) {
    console.error('Error en updateSavingsFromTransaction:', error);
    throw error;
  }
}

// Función para obtener las transacciones del usuario
async function getUserTransactions() {
  try {
    if (isUsingSupabase()) {
      console.log('Obteniendo transacciones del usuario desde Supabase...');

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      // Obtener el ID del usuario que se está visualizando (puede ser diferente del usuario autenticado)
      const currentUserId = sessionStorage.getItem('userId') || user.id;

      console.log('Usuario autenticado:', user.id);
      console.log('Usuario visualizado para transacciones:', currentUserId);

      const { data, error } = await getSupabaseClient()
        .from('transactions')
        .select('*')
        .eq('user_id', currentUserId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error al obtener transacciones:', error);
        throw error;
      }

      console.log('Transacciones obtenidas de Supabase:', data ? data.length : 0);

      // Mostrar las transacciones para depuración
      if (data && data.length > 0) {
        data.forEach((t, index) => {
          console.log(`Transacción ${index + 1} de Supabase:`, t);
        });
      }

      // Convertir de snake_case a camelCase para mantener compatibilidad
      const transformedData = data.map(t => ({
        id: t.id,
        userId: t.user_id,
        type: t.type,
        costType: t.cost_type,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description
      }));

      console.log('Transacciones transformadas:', transformedData.length);
      return transformedData;
    } else {
      // Usar la función original de IndexedDB
      console.log('Obteniendo transacciones del usuario desde IndexedDB...');
      const userId = sessionStorage.getItem('userId');
      const allTransactions = await window.getAllFromDb('transactions');
      const filteredTransactions = allTransactions.filter(t => t.userId === userId);
      console.log('Transacciones obtenidas de IndexedDB:', filteredTransactions.length);
      return filteredTransactions;
    }
  } catch (error) {
    console.error('Error en getUserTransactions:', error);
    throw error;
  }
}

// Función para eliminar una transacción
async function deleteTransaction(id) {
  try {
    if (isUsingSupabase()) {
      console.log('Iniciando deleteTransaction con ID:', id);

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }
      console.log('Usuario autenticado:', user.id);

      // Intentar con método estándar primero
      try {
        const { data, error } = await getSupabaseClient()
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error al eliminar transacción con método estándar:', error);
          throw error;
        }

        console.log('Transacción eliminada correctamente');
        return true;
      } catch (deleteError) {
        console.error('Error al eliminar transacción:', deleteError);

        // Intentar con SQL directo como alternativa
        try {
          console.log('Intentando eliminar transacción con SQL directo');
          const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
            sql_query: `DELETE FROM public.transactions
                      WHERE id = '${id}' AND user_id = '${user.id}'
                      RETURNING id;`
          });

          if (sqlError) {
            console.error('Error al eliminar transacción con SQL directo:', sqlError);
            throw sqlError;
          }

          console.log('Transacción eliminada con SQL directo:', sqlData);
          return true;
        } catch (sqlError) {
          console.error('Error final al eliminar transacción:', sqlError);
          throw sqlError;
        }
      }
    } else {
      // Usar IndexedDB para eliminar la transacción
      return await window.deleteFromDb('transactions', id);
    }
  } catch (error) {
    console.error('Error en deleteTransaction:', error);
    throw error;
  }
}

// Función para obtener todos los usuarios
async function getAllUsers() {
  try {
    if (isUsingSupabase()) {
      console.log('Obteniendo todos los usuarios del equipo desde Supabase...');

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      console.log('Usuario autenticado:', user.id);

      // Obtener el perfil del usuario para obtener el ID del equipo
      const { data: profile, error: profileError } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('team_id', profile.team_id);

      if (error) {
        console.error('Error al obtener usuarios del equipo:', error);
        throw error;
      }

      console.log('Usuarios obtenidos:', data ? data.length : 0);

      // Convertir de snake_case a camelCase para mantener compatibilidad
      const transformedData = data.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        isAdmin: u.is_admin,
        teamId: u.team_id,
        teamName: u.team_name,
        teamCode: u.team_code
      }));

      console.log('Usuarios transformados:', transformedData);
      return transformedData;
    } else {
      // Usar IndexedDB para obtener los usuarios
      console.log('Obteniendo usuarios desde IndexedDB...');
      return await window.getAllFromDb('users');
    }
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    throw error;
  }
}

// Función para refrescar los datos
async function refreshData() {
  try {
    if (isUsingSupabase()) {
      console.log('Refrescando datos desde Supabase...');

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      // Obtener el ID del usuario que se está visualizando (puede ser diferente del usuario autenticado)
      const currentUserId = sessionStorage.getItem('userId') || user.id;

      console.log('Usuario autenticado para refresh:', user.id);
      console.log('Usuario visualizado para refresh:', currentUserId);

      // Obtener transacciones actualizadas del usuario visualizado
      const { data: transactions, error: transactionsError } = await getSupabaseClient()
        .from('transactions')
        .select('*')
        .eq('user_id', currentUserId)
        .order('date', { ascending: false });

      if (transactionsError) {
        console.error('Error al obtener transacciones:', transactionsError);
        throw transactionsError;
      }

      // Convertir de snake_case a camelCase
      const transformedTransactions = transactions.map(t => ({
        id: t.id,
        userId: t.user_id,
        type: t.type,
        costType: t.cost_type,
        amount: t.amount,
        category: t.category,
        date: t.date,
        description: t.description
      }));

      console.log('Transacciones obtenidas en refreshData:', transformedTransactions.length);

      // Actualizar la variable global de transacciones
      window.transactions = transformedTransactions;
      console.log('Variable global window.transactions actualizada:', window.transactions.length);

      // Cargar los ahorros actualizados del usuario visualizado
      const { data: savings, error: savingsError } = await getSupabaseClient()
        .from('savings')
        .select('*')
        .eq('user_id', currentUserId)
        .single();

      if (savingsError && savingsError.code !== 'PGRST116') {
        console.error('Error al cargar ahorros actualizados:', savingsError);
      } else if (savings) {
        window.savingsBalance = savings.balance;
        console.log('Balance de ahorros actualizado:', window.savingsBalance);
      }

      // Cargar el historial de ahorros actualizado del usuario visualizado
      const { data: savingsHistory, error: historyError } = await getSupabaseClient()
        .from('savings_history')
        .select('*')
        .eq('user_id', currentUserId)
        .order('date', { ascending: false });

      if (historyError) {
        console.error('Error al cargar historial de ahorros actualizado:', historyError);
      } else {
        // Convertir de snake_case a camelCase
        window.savingsHistory = savingsHistory.map(h => ({
          id: h.id,
          userId: h.user_id,
          date: h.date,
          type: h.type,
          amount: h.amount,
          balance: h.balance,
          description: h.description
        }));
        console.log('Historial de ahorros actualizado cargado:', window.savingsHistory.length);
      }

      // Actualizar la interfaz
      if (typeof window.updateDashboard === 'function') {
        console.log('Llamando a updateDashboard() desde refreshData');
        window.updateDashboard();
      } else {
        console.warn('La función updateDashboard no está disponible');
      }

      if (typeof window.updateHistoryList === 'function') {
        console.log('Llamando a updateHistoryList() desde refreshData');
        window.updateHistoryList();
      } else {
        console.warn('La función updateHistoryList no está disponible');
      }

      if (typeof window.updateSavingsDisplay === 'function') {
        console.log('Llamando a updateSavingsDisplay() desde refreshData');
        window.updateSavingsDisplay();
      } else {
        console.warn('La función updateSavingsDisplay no está disponible');
      }

      console.log('Datos refrescados correctamente');
      return true;
    } else {
      // No es necesario hacer nada en modo IndexedDB
      console.log('No se está usando Supabase, no se refrescan los datos');
      return true;
    }
  } catch (error) {
    console.error('Error en refreshData:', error);
    throw error;
  }
}

// Función para cargar el perfil de otro usuario
async function loadUserProfile(userId) {
  try {
    console.log('Cargando perfil de usuario desde supabaseServiceNonModule:', userId);

    if (isUsingSupabase()) {
      // Verificar que el usuario pertenezca al mismo equipo
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener el perfil del usuario actual
      const { data: currentUserProfile, error: currentUserError } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (currentUserError) {
        console.error('Error al obtener perfil del usuario actual:', currentUserError);
        throw new Error('No se pudo obtener el perfil del usuario actual');
      }

      // Obtener el perfil del usuario objetivo
      const { data: targetUserProfile, error: targetUserError } = await getSupabaseClient()
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

      const confirmed = await window.showConfirmDialog({
        title: 'Confirmar Carga de Perfil',
        message: '¿Está seguro de cargar este perfil de usuario? Esto reemplazará sus datos actuales.',
        icon: '📊',
        confirmText: 'Cargar Perfil'
      });

      if (!confirmed) return false;

      // Reiniciar datos actuales
      window.transactions = [];
      window.savingsBalance = 0;
      window.savingsHistory = [];

      // Ya no intentamos clonar los datos, simplemente cargamos los datos del usuario objetivo
      console.log('Cargando datos del usuario objetivo (ID):', targetUserId);

      // Cargar las transacciones actualizadas - IMPORTANTE: Usar targetUserId para cargar los datos del usuario objetivo
      const { data: updatedTransactions, error: updatedTransactionsError } = await getSupabaseClient()
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
      const { data: updatedSavings, error: updatedSavingsError } = await getSupabaseClient()
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
      const { data: updatedSavingsHistory, error: updatedHistoryError } = await getSupabaseClient()
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

      // Actualizar la interfaz
      window.updateDashboard();
      window.updateSavingsDisplay();
      window.calculateKPIs();
      window.updateHistoryList();
      window.updateCategoryList();
      window.generateReport('balanco');
      window.generateReport('dre');
      window.generateReport('fluxoCaixa');

      window.showNotification('¡Éxito!', 'Perfil cargado correctamente', 'success');
      return true;
    } else {
      // Usar la función original de IndexedDB
      return await window.loadUserProfile(userId);
    }
  } catch (error) {
    console.error('Error al cargar perfil de usuario:', error);
    window.showNotification('Error', error.message || 'Ocurrió un error al cargar el perfil', 'error');
    return false;
  }
}

// Función para obtener transacciones (alias de getUserTransactions para compatibilidad)
async function getTransactions() {
  return await getUserTransactions();
}

// Función para obtener una transacción por su ID
async function getTransactionById(id) {
  try {
    if (isUsingSupabase()) {
      console.log('Obteniendo transacción por ID desde Supabase:', id);

      // Obtener el usuario actual
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user) {
        console.error('Error: Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      const { data, error } = await getSupabaseClient()
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error al obtener transacción por ID:', error);
        throw error;
      }

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
    } else {
      // Usar IndexedDB
      console.log('Obteniendo transacción por ID desde IndexedDB:', id);
      return await window.getFromDb('transactions', id);
    }
  } catch (error) {
    console.error('Error en getTransactionById:', error);
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
  getAllTeams,
  addTransaction,
  updateSavingsFromTransaction,
  getUserTransactions,
  getTransactions, // Añadir alias para compatibilidad
  getTransactionById, // Añadir función para obtener transacción por ID
  deleteTransaction,
  refreshData,
  getAllUsers,
  loadUserProfile
};

// Exponer funciones directamente en window para compatibilidad
window.addTransaction = addTransaction;
window.deleteTransaction = deleteTransaction;
window.refreshData = refreshData;
window.getAllUsers = getAllUsers;
window.loadUserProfile = loadUserProfile;
window.getTransactions = getTransactions; // Exponer getTransactions globalmente
window.getTransactionById = getTransactionById; // Exponer getTransactionById globalmente
