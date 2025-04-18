// Funciones de autenticación para Supabase (versión no modular)

// Función para generar UUIDs
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Función para registrar un usuario en Supabase
async function registerUserInSupabase(username, email, password, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  try {
    console.log('Registrando usuario en Supabase:', email);

    // 1. Registrar el usuario en Supabase Auth
    const { data: authData, error: authError } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          is_admin: isAdmin,
          team_id: teamId,
          team_name: teamName,
          team_code: teamCode
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
    // y el trigger sincronice los datos con public.users
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Actualizar los campos adicionales en la tabla users
    const { data: userData, error: userError } = await getSupabaseClient()
      .from('users')
      .update({
        username: username,
        is_admin: isAdmin,
        team_id: teamId,
        team_name: teamName,
        team_code: teamCode
      })
      .eq('id', userId)
      .select();

    if (userError) {
      console.error('Error al actualizar perfil de usuario en Supabase:', userError);
      // No lanzamos el error, intentamos continuar
    }

    console.log('Perfil de usuario actualizado en Supabase:', userData || 'No se pudo actualizar');

    // 3. Crear un registro de ahorros para el usuario
    const savingsId = uuidv4();
    const { data: savingsData, error: savingsError } = await getSupabaseClient()
      .from('savings')
      .insert([
        {
          id: savingsId,
          user_id: userId,
          balance: 0
        }
      ])
      .select();

    if (savingsError) {
      console.error('Error al crear registro de ahorros en Supabase:', savingsError);
      // No lanzamos el error, intentamos continuar
    }

    console.log('Registro de ahorros creado en Supabase:', savingsData || 'No se pudo crear');

    // Obtener el perfil actualizado
    let profile;
    try {
      const { data: profileData, error: profileError } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profileError) {
        profile = profileData;
      }
    } catch (profileErr) {
      console.error('Error al obtener perfil actualizado:', profileErr);
    }

    return {
      success: true,
      user: authData.user,
      profile: profile || { id: userId, username, email, is_admin: isAdmin },
      savings: savingsData ? savingsData[0] : { id: savingsId, user_id: userId, balance: 0 }
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

    // Obtener el perfil del usuario
    let profile;
    try {
      const { data: profileData, error: profileError } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Error al obtener perfil de usuario en Supabase:', profileError);
        // No lanzamos el error, intentamos continuar
      } else {
        profile = profileData;
      }
    } catch (profileErr) {
      console.error('Excepción al obtener perfil de usuario:', profileErr);
      // No lanzamos el error, intentamos continuar
    }

    // Si no pudimos obtener el perfil, creamos un objeto con valores predeterminados
    if (!profile) {
      profile = {
        id: data.user.id,
        username: email.split('@')[0], // Usar la parte del email como nombre de usuario
        email: email,
        is_admin: false
      };
      console.log('Usando perfil predeterminado:', profile);
    }

    console.log('Perfil de usuario obtenido de Supabase:', profile);

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

    // Método simplificado: intentar buscar directamente en la tabla de autenticación
    const { data, error } = await getSupabaseClient().auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false // No crear un nuevo usuario, solo verificar
      }
    });

    // Si no hay error y hay datos, significa que el correo existe
    if (!error) {
      console.log('El correo existe en Supabase Auth');
      return true;
    }

    // Si el error es "Email not confirmed", también significa que el correo existe
    if (error && error.message && error.message.includes('Email not confirmed')) {
      console.log('El correo existe pero no está confirmado');
      return true;
    }

    // Si el error es "User not found" o similar, el correo no existe
    if (error && error.message && (error.message.includes('not found') || error.message.includes('Invalid login credentials'))) {
      console.log('El correo no existe en Supabase Auth');
      return false;
    }

    // Como alternativa, verificar en la tabla users
    console.log('Verificando en la tabla users como alternativa');
    const { data: userData, error: userError } = await getSupabaseClient()
      .from('users')
      .select('email')
      .eq('email', email);

    if (userError) {
      console.error('Error al verificar correo en tabla users:', userError);
      return false; // No podemos confirmar, asumimos que no está registrado
    }

    return userData && userData.length > 0;
  } catch (error) {
    console.error('Error al verificar si el correo está registrado:', error);
    return false; // En caso de error, asumimos que no está registrado
  }
}

// Exponer las funciones globalmente
window.supabaseAuth = {
  registerUser: registerUserInSupabase,
  loginUser: loginUserInSupabase,
  isEmailRegistered: isEmailRegistered
};
