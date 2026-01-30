const supabase = require('../config/supabase');

class AuthService {

  // REGISTER
  async register(email, password, fullName) {
    try {
      // 1. Create user in Supabase Auth System
      // We use the Admin API to create the user securely.
      const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Auto-confirm email so they can login immediately
        user_metadata: {
          full_name: fullName // This is passed to the Trigger to fill the public table
        }
      });

      if (error) throw error;

      // 2. THAT'S IT!
      // You do NOT need to insert into 'users' table manually.
      // The SQL Trigger 'on_auth_user_created' we ran earlier does it automatically.

      return data.user;

    } catch (error) {
      console.error("Registration Error:", error.message);
      throw new Error(error.message);
    }
  }

  // LOGIN
  async login(email, password) {
    // 1. Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error('Invalid login credentials');
    }

    // 2. Get User Profile (Role, Balance, etc.)
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      // If profile is missing (rare sync issue), return basic auth data
      console.warn("User profile not found in public table, returning auth data only.");
    }

    return {
      user: userProfile || { ...data.user, role: 'user' },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token
    };
  }
}

module.exports = new AuthService();