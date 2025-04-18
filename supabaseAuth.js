// Funciones de autenticación para Supabase (versión no modular)

// Función para registrar un usuario en Supabase
async function registerUserInSupabase(username, email, password, isAdmin = false) {
  try {
    console.log('Registrando usuario en Supabase:', email);
    
    // 1. Registrar el usuario en Supabase Auth
    const { data: authData, error: authError } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          is_admin: isAdmin
        }
      }
    });
    
    if (authError) {
      console.error('Error al registrar usuario en Supabase Auth:', authError);
      throw authError;
    }
    
    console.log('Usuario registrado en Supabase Auth:', authData);
    
    // 2. Crear el perfil del usuario en la tabla users
    const userId = authData.user.id;
    const { data: userData, error: userError } = await getSupabaseClient()
      .from('users')
      .insert([
        {
          id: userId,
          username: username,
          email: email,
          is_admin: isAdmin,
          team_id: null,
          team_name: null,
          team_code: null
        }
      ])
      .select();
    
    if (userError) {
      console.error('Error al crear perfil de usuario en Supabase:', userError);
      throw userError;
    }
    
    console.log('Perfil de usuario creado en Supabase:', userData);
    
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
      throw savingsError;
    }
    
    console.log('Registro de ahorros creado en Supabase:', savingsData);
    
    return {
      success: true,
      user: authData.user,
      profile: userData[0],
      savings: savingsData[0]
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
    const { data: profile, error: profileError } = await getSupabaseClient()
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (profileError) {
      console.error('Error al obtener perfil de usuario en Supabase:', profileError);
      throw profileError;
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

// Exponer las funciones globalmente
window.supabaseAuth = {
  registerUser: registerUserInSupabase,
  loginUser: loginUserInSupabase
};
