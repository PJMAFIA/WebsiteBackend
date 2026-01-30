const supabase = require('../config/supabase');

class UserService {
  
  // 🟢 NEW: Handles fetching OR creating the user
  async getOrSyncUser(authUser) {
    if (!authUser || !authUser.id) {
      throw new Error('Invalid auth user data');
    }

    // 1. Try to find the user in public.users
    let { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, balance, created_at')
      .eq('id', authUser.id)
      .maybeSingle(); // Use maybeSingle to avoid error if not found

    // 2. If not found, CREATE them immediately
    if (!user) {
      console.log(`🆕 User ${authUser.email} missing in DB. Creating now...`);
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'New User',
          role: 'user',
          balance: 0.00
        }])
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }
      user = newUser;
    }

    // Return clean user object
    return {
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
      balance: parseFloat(user.balance || 0),
      createdAt: user.created_at
    };
  }

  // Helper for fetching by ID directly
  async getUserById(userId) {
    return this.getOrSyncUser({ id: userId });
  }
}

module.exports = new UserService();