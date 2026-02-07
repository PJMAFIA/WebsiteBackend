const authService = require('../services/authService');
const { registerSchema, loginSchema } = require('../utils/validators');
const supabase = require('../config/supabase');
const sendEmail = require('../utils/emailService');

// Helper: Generate 6-digit code
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Step 1: Send Verification Code (With Zombie Cleanup)
exports.sendVerificationCode = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ status: 'error', message: 'All fields are required' });
    }

    // 1. Check if user exists in PUBLIC 'users' table (Real Account)
    const { data: dbUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (dbUser) {
      return res.status(400).json({ status: 'error', message: 'Email already registered' });
    }

    // 2. 🔥 ZOMBIE CHECK: Check if user exists in SUPABASE AUTH (Ghost Account)
    // If they verify their email but didn't finish registration previously, they might exist here.
    const { data: authData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (!listError && authData?.users) {
      const ghostUser = authData.users.find(u => u.email === email);
      if (ghostUser) {
        console.log(`👻 Found Ghost User in Auth (ID: ${ghostUser.id}). Deleting to allow fresh signup...`);
        await supabase.auth.admin.deleteUser(ghostUser.id);
      }
    }

    // 3. Generate Code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    // 4. Save Code to DB (Clean up old codes first)
    await supabase.from('verification_codes').delete().eq('email', email);
    
    const { error: dbError } = await supabase.from('verification_codes').insert([{
      email,
      code,
      expires_at: expiresAt.toISOString()
    }]);

    if (dbError) throw dbError;

    // 5. Email Code
    await sendEmail(
      email,
      '🔐 Your Verification Code',
      `<h3>Verify your email</h3>
       <p>Hello ${name},</p>
       <p>Your verification code for Universal Store is:</p>
       <h2 style="background:#f4f4f4; padding:10px; display:inline-block; letter-spacing:5px;">${code}</h2>
       <p>This code expires in 15 minutes.</p>`
    );

    res.status(200).json({ status: 'success', message: 'Verification code sent to email' });

  } catch (error) {
    console.error("Send Code Error:", error);
    res.status(500).json({ status: 'error', message: error.message || 'Failed to send code' });
  }
};

// Step 2: Verify Code & Register
exports.verifyAndRegister = async (req, res) => {
  try {
    const { email, password, full_name, code } = req.body;

    if (!code) return res.status(400).json({ status: 'error', message: 'Verification code is required' });

    // 1. Verify Code
    const { data: record } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .single();

    if (!record) {
      return res.status(400).json({ status: 'error', message: 'Invalid verification code' });
    }

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ status: 'error', message: 'Code has expired. Please try again.' });
    }

    // 2. Create Account (Real Registration via Service)
    const user = await authService.register(email, password, full_name);

    // 3. Cleanup Code
    await supabase.from('verification_codes').delete().eq('email', email);

    // 4. Send Welcome Email
    await sendEmail(
      email,
      '🚀 Welcome to Universal Store!',
      `<h3>Welcome, ${full_name}!</h3><p>Your account has been successfully verified and created.</p>`
    );

    res.status(201).json({
      status: 'success',
      message: 'Account verified and created successfully',
      data: { user }
    });

  } catch (error) {
    console.error("Verify Register Error:", error);
    // If it's the duplicate error, it means the race condition happened or cleanup failed
    if (error.message.includes('already been registered')) {
        return res.status(400).json({ status: 'error', message: 'User already exists. Please login.' });
    }
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// Login (Unchanged)
exports.login = async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData.email, validatedData.password);
    res.status(200).json({ status: 'success', message: 'Logged in successfully', data: result });
  } catch (error) {
    res.status(401).json({ status: 'error', message: error.message });
  }
};