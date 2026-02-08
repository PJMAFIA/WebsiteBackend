const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// --- Import Routes ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes'); 
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const licenseRoutes = require('./routes/licenseRoutes');
const balanceRoutes = require('./routes/balanceRoutes'); 
const resetRoutes = require('./routes/resetRoutes'); // ✅ ADDED

const app = express();

// --- Middlewares ---
app.use(helmet({ crossOriginResourcePolicy: false })); 
app.use(cors()); 
app.use(morgan('dev')); 
app.use(express.json()); 

// --- Static Files ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Mount Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/resets', resetRoutes); // ✅ MOUNTED

// --- Base Route ---
app.get('/', (req, res) => {
  res.json({ message: '🚀 Premium SaaS API is running' });
});

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('❌ Error Stack:', err.stack);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 'error',
      message: 'File is too large. Max limit is 5MB.'
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    status: 'error', 
    message: err.message || 'Internal Server Error' 
  });
});

module.exports = app;