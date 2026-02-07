const supabase = require('../config/supabase');

class AuthService {

  // REGISTER (Admin API to auto-confirm)
  async register(email, password, fullName) {
    try {
      // 1. Create user in Supabase Auth (Auto Confirmed)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, 
        user_metadata: { full_name: fullName }
      });

      if (authError) throw authError;

      // 2. Upsert into public table
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .upsert([{
          id: authData.user.id,
          email: email,
          full_name: fullName,
          role: 'user',
          balance: 0,
          currency: 'USD'
        }])
        .select()
        .single();

      if (dbError) {
        await supabase.auth.admin.deleteUser(authData.user.id); // Rollback
        throw new Error(dbError.message);
      }

      return userData;
    } catch (error) {
      console.error("Registration Error:", error.message);
      throw new Error(error.message);
    }
  }

  // LOGIN
  async login(email, password) {
    // 1. Sign In
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw new Error('Invalid login credentials');

    // 2. Fetch Profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // 3. Return Data (Aligned with Frontend)
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: userProfile?.full_name || data.user.user_metadata.full_name,
        role: userProfile?.role || 'user',
        balance: userProfile?.balance || 0,
        currency: userProfile?.currency || 'USD'
      },
      // ✅ FIX: Variable name is 'token'
      token: data.session.access_token, 
      refreshToken: data.session.refresh_token
    };
  }
}

module.exports = new AuthService();