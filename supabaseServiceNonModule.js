// Supabase Service - Versión no modular

// Funciones de autenticación
async function signUp(email, password, username, isAdmin = false, teamId = null, teamName = null, teamCode = null) {
  try {
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
  } catch (error) {
    console.error('Error en signUp:', error);
    throw error;
  }
}

async function signIn(email, password) {
  try {
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
  } catch (error) {
    console.error('Error en signIn:', error);
    throw error;
  }
}

async function signOut() {
  try {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error en signOut:', error);
    throw error;
  }
}

async function getCurrentUser() {
  try {
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
