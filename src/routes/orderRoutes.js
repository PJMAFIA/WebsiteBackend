const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware'); 

// --- User Routes ---

// 1. Create Order (Manual Upload with Screenshot)
router.post(
  '/', 
  protect, 
  upload.single('paymentScreenshot'), 
  orderController.createOrder
);

// 🔥 2. Wallet Purchase (Instant - NEW ROUTE)
// This fixes the 404 Error. It MUST be defined before /:id routes
router.post(
  '/wallet', 
  protect, 
  orderController.purchaseWithWallet
);

// 3. Get My Orders
router.get('/my-orders', protect, orderController.getMyOrders);

// --- Admin Routes ---

// 4. Get All Orders
router.get(
  '/admin/all', 
  protect, 
  adminOnly, 
  orderController.getAllOrders
);

// 5. Approve/Reject Order
router.patch(
  '/:id/status', 
  protect, 
  adminOnly, 
  orderController.updateStatus
);

module.exports = router;