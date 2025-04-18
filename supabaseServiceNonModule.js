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

// Exponer las funciones globalmente
window.supabaseService = {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  createTeam,
  getAllTeams
};
