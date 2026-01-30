const supabase = require('../config/supabase');

class UserController {

  // 1. Get Current User Profile (Me)
  async getMe(req, res) {
    try {
      // req.user.id comes from the Auth Middleware (the Token)
      const userId = req.user.id;

      // 🔍 We must query the 'users' table to get the BALANCE
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Fetch Profile Error:", error.message);
        // Fallback: If public profile is missing, return basic auth info (balance 0)
        return res.status(200).json({
          status: 'success',
          data: {
            id: userId,
            email: req.user.email,
            name: req.user.user_metadata?.full_name || 'User',
            role: 'user',
            balance: 0.00
          }
        });
      }

      // ✅ Return the full profile with BALANCE
      res.status(200).json({
        status: 'success',
        data: {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.full_name,
          role: userProfile.role,
          balance: parseFloat(userProfile.balance) || 0.00, // Ensure it's a number
          createdAt: userProfile.created_at
        }
      });

    } catch (error) {
      console.error("Get Me Error:", error.message);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 2. Update Profile (Optional)
  async updateMe(req, res) {
    try {
      const { full_name } = req.body;
      
      const { data, error } = await supabase
        .from('users')
        .update({ full_name })
        .eq('id', req.user.id)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({ status: 'success', data });

    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new UserController();