require('dotenv').config();
const app = require('./src/app');

// 🚀 CRITICAL FOR DEPLOYMENT: 
// Render will provide a port in process.env.PORT. 
// If it's missing (localhost), we fallback to 5000.
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n---------------------------------------------------`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⭐️ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`---------------------------------------------------\n`);
});