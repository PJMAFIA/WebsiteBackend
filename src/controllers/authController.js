const authService = require('../services/authService');
const { registerSchema, loginSchema } = require('../utils/validators');

// Register Controller
exports.register = async (req, res) => {
  try {
    // Validate Input
    const validatedData = registerSchema.parse(req.body);

    const user = await authService.register(
      validatedData.email,
      validatedData.password,
      validatedData.full_name
    );

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: { user }
    });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message || error.errors });
  }
};

// Login Controller
exports.login = async (req, res) => {
  try {
    // Validate Input
    const validatedData = loginSchema.parse(req.body);

    const result = await authService.login(
      validatedData.email,
      validatedData.password
    );

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully',
      data: result
    });
  } catch (error) {
    res.status(401).json({ status: 'error', message: error.message });
  }
};