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

// 2. Wallet Purchase (Instant)
router.post(
  '/wallet', 
  protect, 
  orderController.purchaseWithWallet
);

// ✅ 3. NEW: Claim Free Trial (Fixes the 404 Error)
router.post(
  '/claim-trial',
  protect,
  orderController.claimTrial
);

// 4. Get My Orders
router.get('/my-orders', protect, orderController.getMyOrders);

// --- Admin Routes ---

// 5. Get All Orders
router.get(
  '/admin/all', 
  protect, 
  adminOnly, 
  orderController.getAllOrders
);

// 6. Approve/Reject Order
router.patch(
  '/:id/status', 
  protect, 
  adminOnly, 
  orderController.updateStatus
);

module.exports = router;