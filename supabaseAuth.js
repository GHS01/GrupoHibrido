// Funciones de autenticación para Supabase (versión no modular)

// Función para generar UUIDs
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Función para verificar si un equipo existe en Supabase
async function verifyTeamExists(teamId) {
  if (!teamId) return false;

  try {
    console.log('Verificando si el equipo existe en Supabase:', teamId);

    // Intentar con método estándar primero
    try {
      const { data, error } = await getSupabaseClient()
        .from('teams')
        .select('id')
        .eq('id', teamId)
        .single();

      if (!error && data) {
        console.log('Equipo encontrado con método estándar:', data);
        return true;
      }
    } catch (stdError) {
      console.error('Error al verificar equipo con método estándar:', stdError);
    }

    // Intentar con SQL directo como alternativa
    try {
      const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
        sql_query: `SELECT EXISTS(SELECT 1 FROM public.teams WHERE id = '${teamId}') AS exists;`
      });

      if (!sqlError && sqlData && sqlData.exists === true) {
        console.log('Equipo encontrado con SQL directo');
        return true;
      }
    } catch (sqlError) {
      console.error('Error al verificar equipo con SQL directo:', sqlError);
    }

    console.log('El equipo no existe en Supabase:', teamId);
    return false;
  } catch (error) {
    console.error('Error general al verificar equipo:', error);
    return false;
  }
}

// Función para registrar un usuario en Supabase
async function registerUserInSupabase(username, email, password, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  try {
    console.log('Registrando usuario en Supabase:', email);

    // Verificar si el equipo existe en Supabase
    if (teamId) {
      const teamExists = await verifyTeamExists(teamId);
      if (!teamExists) {
        console.warn('El equipo no existe en Supabase. Intentando crearlo...');

        // Intentar crear el equipo en Supabase
        try {
          const { data: teamData, error: teamError } = await getSupabaseClient().rpc('insert_team_safely', {
            team_id: teamId,
            team_name: teamName || 'Equipo sin nombre',
            team_code: teamCode || 'CODE-0000',
            team_password: '123456', // Contraseña por defecto
            team_created_by: email
          });

          if (teamError) {
            console.error('Error al crear equipo en Supabase:', teamError);
          } else {
            console.log('Equipo creado en Supabase:', teamData);
          }
        } catch (teamCreateError) {
          console.error('Error al crear equipo en Supabase:', teamCreateError);
        }
      }
    }

    // 1. Registrar el usuario en Supabase Auth
    console.log('Registrando usuario con datos de equipo:', { teamId, teamName, teamCode });
    const { data: authData, error: authError } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          is_admin: isAdmin,
          team_id: teamId,
          team_name: teamName,
          team_code: teamCode,
          email_verified: true,
          phone_verified: false
        }
      }
    });

    if (authError) {
      console.error('Error al registrar usuario en Supabase Auth:', authError);
      throw authError;
    }

    console.log('Usuario registrado en Supabase Auth:', authData);

    // Obtener el ID del usuario
    const userId = authData.user.id;

    // Esperar un momento para que Supabase Auth termine de crear el usuario
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Insertar usuario usando la función RPC segura
    try {
      const { data: userData, error: userError } = await getSupabaseClient().rpc('insert_user_safely', {
        user_id: userId,
        user_email: email,
        user_username: username,
        user_is_admin: isAdmin,
        user_team_id: teamId,
        user_team_name: teamName,
        user_team_code: teamCode
      });

      if (userError) {
        console.error('Error al insertar usuario con función segura:', userError);

        // Intentar un enfoque alternativo si falla la función RPC
        try {
          // Usar una consulta SQL directa como alternativa, incluyendo team_id
          const { data: directData, error: directError } = await getSupabaseClient().rpc('execute_sql', {
            sql_query: `INSERT INTO public.users (id, email, username, is_admin, team_id, team_name, team_code)
                       VALUES ('${userId}', '${email}', '${username}', ${isAdmin},
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
                       RETURNING *;`
          });

          if (directError) {
            console.error('Error al insertar usuario directamente:', directError);
          } else {
            console.log('Usuario insertado directamente (sin team_id):', directData);
          }
        } catch (sqlError) {
          console.error('Error al ejecutar SQL directo:', sqlError);
        }
      } else {
        console.log('Usuario insertado con función segura:', userData);
      }
    } catch (insertError) {
      console.error('Error general al insertar usuario:', insertError);
    }

    // 3. Crear un registro de ahorros para el usuario
    const savingsId = uuidv4();
    try {
      // Usar RPC para evitar problemas con RLS
      const { data: savingsData, error: savingsError } = await getSupabaseClient().rpc('insert_savings_directly', {
        savings_id: savingsId,
        savings_user_id: userId,
        savings_balance: 0
      });

      if (savingsError) {
        console.error('Error al crear registro de ahorros en Supabase:', savingsError);
        // Intentar un enfoque alternativo
        const { data: directSavingsData, error: directSavingsError } = await getSupabaseClient().rpc('execute_sql', {
          sql_query: `INSERT INTO public.savings (id, user_id, balance)
                     VALUES ('${savingsId}', '${userId}', 0)
                     RETURNING *;`
        });

        if (directSavingsError) {
          console.error('Error al insertar ahorros directamente:', directSavingsError);
        } else {
          console.log('Ahorros insertados directamente:', directSavingsData);
        }
      } else {
        console.log('Registro de ahorros creado en Supabase:', savingsData);
      }
    } catch (savingsErr) {
      console.error('Error al crear ahorros:', savingsErr);
    }

    return {
      success: true,
      user: authData.user,
      profile: { id: userId, username, email, is_admin: isAdmin },
      savings: { id: savingsId, user_id: userId, balance: 0 }
    };
  } catch (error) {
    console.error('Error en registerUserInSupabase:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al registrar usuario'
    };
  }
}

// Función para iniciar sesión en Supabase
async function loginUserInSupabase(email, password) {
  try {
    console.log('Iniciando sesión en Supabase:', email);

    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Error al iniciar sesión en Supabase:', error);
      throw error;
    }

    console.log('Sesión iniciada en Supabase:', data);

    // Obtener el perfil del usuario usando RPC para evitar problemas con RLS
    let profile;
    try {
      // Intentar obtener el perfil usando una función RPC
      const { data: profileData, error: profileError } = await getSupabaseClient().rpc('get_user_by_id', {
        user_id: data.user.id
      });

      if (profileError) {
        console.error('Error al obtener perfil con RPC:', profileError);

        // Intentar con SQL directo como alternativa
        try {
          const { data: directData, error: directError } = await getSupabaseClient().rpc('execute_sql', {
            sql_query: `SELECT * FROM public.users WHERE id = '${data.user.id}' LIMIT 1;`
          });

          if (directError) {
            console.error('Error al obtener perfil con SQL directo:', directError);
          } else if (directData && directData.length > 0) {
            profile = directData[0];
            console.log('Perfil obtenido con SQL directo:', profile);
          }
        } catch (sqlError) {
          console.error('Error al ejecutar SQL directo para perfil:', sqlError);
        }
      } else if (profileData) {
        profile = profileData;
        console.log('Perfil obtenido con RPC:', profile);
      }
    } catch (profileErr) {
      console.error('Excepción al obtener perfil de usuario:', profileErr);
    }

    // Si aún no tenemos perfil, intentar con el método original como último recurso
    if (!profile) {
      try {
        console.log('Intentando obtener perfil con método estándar...');
        const { data: standardData, error: standardError } = await getSupabaseClient()
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!standardError) {
          profile = standardData;
          console.log('Perfil obtenido con método estándar:', profile);
        }
      } catch (stdError) {
        console.error('Error con método estándar:', stdError);
      }
    }

    // Si aún no tenemos perfil, usar los metadatos del usuario o crear uno predeterminado
    if (!profile) {
      // Intentar obtener datos de los metadatos del usuario
      const metadata = data.user.user_metadata || {};
      profile = {
        id: data.user.id,
        username: metadata.username || email.split('@')[0],
        email: email,
        is_admin: metadata.is_admin || false,
        team_id: metadata.team_id || null,
        team_name: metadata.team_name || null,
        team_code: metadata.team_code || null
      };
      console.log('Usando perfil desde metadatos o predeterminado:', profile);

      // Si tenemos información del equipo en los metadatos, intentar guardarla en la tabla users
      if (metadata.team_id && metadata.team_name) {
        try {
          console.log('Actualizando perfil en la base de datos con información del equipo');
          const { data: updateData, error: updateError } = await getSupabaseClient()
            .from('users')
            .upsert({
              id: data.user.id,
              email: email,
              username: metadata.username || email.split('@')[0],
              is_admin: metadata.is_admin || false,
              team_id: metadata.team_id,
              team_name: metadata.team_name,
              team_code: metadata.team_code
            });

          if (updateError) {
            console.error('Error al actualizar perfil con información del equipo:', updateError);
          } else {
            console.log('Perfil actualizado correctamente con información del equipo');
          }
        } catch (updateError) {
          console.error('Error al actualizar perfil con información del equipo:', updateError);
        }
      }
    }

    console.log('Perfil de usuario final:', profile);

    // Guardar el ID del usuario en sessionStorage
    sessionStorage.setItem('userId', data.user.id);
    sessionStorage.setItem('isAdmin', profile.is_admin);

    return {
      success: true,
      user: data.user,
      profile: profile
    };
  } catch (error) {
    console.error('Error en loginUserInSupabase:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al iniciar sesión'
    };
  }
}

// Función para verificar si un correo electrónico ya está registrado
async function isEmailRegistered(email) {
  try {
    console.log('Verificando si el correo está registrado en Supabase:', email);

    // Método 1: Verificar con OTP (más confiable para auth)
    try {
      const { data, error } = await getSupabaseClient().auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false // No crear un nuevo usuario, solo verificar
        }
      });

      // Si no hay error y hay datos, significa que el correo existe
      if (!error) {
        console.log('El correo existe en Supabase Auth (OTP)');
        return true;
      }

      // Si el error es "Email not confirmed", también significa que el correo existe
      if (error && error.message && error.message.includes('Email not confirmed')) {
        console.log('El correo existe pero no está confirmado');
        return true;
      }

      // Si el error es "User not found" o similar, el correo no existe
      if (error && error.message && (error.message.includes('not found') || error.message.includes('Invalid login credentials'))) {
        console.log('El correo no existe en Supabase Auth (OTP)');
        // Continuamos con otros métodos
      }
    } catch (otpError) {
      console.error('Error al verificar con OTP:', otpError);
      // Continuamos con otros métodos
    }

    // Método 2: Verificar con SQL directo (evita problemas de RLS)
    try {
      console.log('Verificando con SQL directo');
      const { data: sqlData, error: sqlError } = await getSupabaseClient().rpc('execute_sql', {
        sql_query: `SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = '${email}') AS exists;`
      });

      if (!sqlError && sqlData && sqlData.exists === true) {
        console.log('El correo existe en auth.users (SQL)');
        return true;
      }

      // Verificar también en public.users
      const { data: sqlDataPublic, error: sqlErrorPublic } = await getSupabaseClient().rpc('execute_sql', {
        sql_query: `SELECT EXISTS(SELECT 1 FROM public.users WHERE email = '${email}') AS exists;`
      });

      if (!sqlErrorPublic && sqlDataPublic && sqlDataPublic.exists === true) {
        console.log('El correo existe en public.users (SQL)');
        return true;
      }
    } catch (sqlCheckError) {
      console.error('Error al verificar con SQL directo:', sqlCheckError);
    }

    // Método 3: Como último recurso, usar el método estándar
    try {
      console.log('Verificando con método estándar');
      const { data: userData, error: userError } = await getSupabaseClient()
        .from('users')
        .select('email')
        .eq('email', email);

      if (!userError && userData && userData.length > 0) {
        console.log('El correo existe en users (estándar)');
        return true;
      }
    } catch (stdError) {
      console.error('Error al verificar con método estándar:', stdError);
    }

    // Si llegamos aquí, el correo no está registrado
    console.log('El correo no está registrado en ninguna tabla');
    return false;
  } catch (error) {
    console.error('Error general al verificar si el correo está registrado:', error);
    return false; // En caso de error, asumimos que no está registrado
  }
}

// Exponer las funciones globalmente
window.supabaseAuth = {
  registerUser: registerUserInSupabase,
  loginUser: loginUserInSupabase,
  isEmailRegistered: isEmailRegistered
};
