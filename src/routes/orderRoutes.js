const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
// If you are using Multer for file uploads locally before sending to Supabase:
const upload = require('../middlewares/uploadMiddleware'); 

// --- User Routes ---

// Create Order
// NOTE: Ensure your Frontend sends the file with key="paymentScreenshot"
router.post(
  '/', 
  protect, 
  // If you are NOT uploading files via this API (e.g. sending URL string), remove upload.single
  upload.single('paymentScreenshot'), 
  orderController.createOrder
);

// Get My Orders
router.get('/my-orders', protect, orderController.getMyOrders);

// --- Admin Routes ---

// Get All Orders
router.get(
  '/admin/all', 
  protect, 
  adminOnly, 
  orderController.getAllOrders
);

// Approve/Reject Order
router.patch(
  '/:id/status', 
  protect, 
  adminOnly, 
  orderController.updateStatus
);

module.exports = router;