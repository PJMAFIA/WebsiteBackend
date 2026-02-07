const supabase = require('../config/supabase');

exports.protect = async (req, res, next) => {
  let token;

  // 1. Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // 2. Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new Error('Invalid Token');
      }

      // 3. Attach user profile to request (Role is critical for Admin checks)
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      // Merge Auth User + Public Profile
      req.user = { 
        ...user, 
        role: userProfile?.role || 'user',
        balance: userProfile?.balance || 0,
        currency: userProfile?.currency || 'USD'
      };
      
      next();

    } catch (error) {
      console.error("❌ Auth Middleware Error:", error.message);
      return res.status(401).json({ status: 'error', message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ status: 'error', message: 'Not authorized, no token' });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ status: 'error', message: 'Access denied. Admins only.' });
  }
};