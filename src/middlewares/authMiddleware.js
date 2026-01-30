const supabase = require('../config/supabase');

// 🛡️ Middleware: Protect Routes
exports.protect = async (req, res, next) => {
  let token;

  // 1. Get token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Not authorized, no token provided' });
  }

  try {
    // 2. Verify token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      // 🚨 LOG THE SPECIFIC ERROR TO TERMINAL
      console.error("❌ Supabase Auth Verification Failed:");
      console.error("   - Token sent by frontend:", token.substring(0, 15) + "...");
      console.error("   - Error Message:", error.message);
      
      return res.status(401).json({ 
        status: 'error', 
        message: `Token Verification Failed: ${error.message}` 
      });
    }

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User not found' });
    }

    req.user = user; 
    next();

  } catch (error) {
    console.error("🔥 Middleware Crash:", error.message);
    res.status(401).json({ status: 'error', message: 'Not authorized, token failed' });
  }
};

// 🛡️ Middleware: Admin Only
exports.adminOnly = async (req, res, next) => {
  try {
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (!userProfile || userProfile.role !== 'admin') {
      return res.status(403).json({ status: 'error', message: 'Access denied. Admins only.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Authorization check failed' });
  }
};