// Supabase Service - Versión no modular

// Funciones de autenticación
async function signUp(email, password, username, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  try {
    console.log('¿Usar Supabase para registro?', isUsingSupabase());

    if (isUsingSupabase()) {
      // 1. Registrar el usuario en Supabase Auth
      const { data: authData, error: authError } = await getSupabaseClient().auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Crear el perfil del usuario en la tabla users
      const userId = authData.user.id;
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

      if (profileError) throw profileError;

      // 3. Crear un registro de ahorros para el usuario
      const { error: savingsError } = await getSupabaseClient()
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
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Obtener el perfil del usuario
      const { data: profile, error: profileError } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      return { user: data.user, profile };
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
      const { data: { user }, error } = await getSupabaseClient().auth.getUser();

      if (error) throw error;
      if (!user) return null;

      // Obtener el perfil del usuario
      const { data: profile, error: profileError } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      return { user, profile };
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

// Exponer las funciones globalmente
window.supabaseService = {
  signUp,
  signIn,
  signOut,
  getCurrentUser
};
