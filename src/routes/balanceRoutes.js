const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balanceController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// 1. Submit Balance Request (User)
router.post(
  '/', 
  protect, 
  upload.single('paymentScreenshot'), // Frontend must use this key
  balanceController.createRequest
);

// 2. Get User's Own Requests
router.get(
  '/my-requests', 
  protect, 
  balanceController.getUserRequests
);

// 3. Get All Requests (Admin)
router.get(
  '/admin/all', 
  protect, 
  adminOnly, 
  balanceController.getAllRequests
);

// 4. Approve Request (Admin)
router.patch(
  '/:id/approve', 
  protect, 
  adminOnly, 
  balanceController.approveRequest
);

// 5. Reject Request (Admin)
router.patch(
  '/:id/reject', 
  protect, 
  adminOnly, 
  balanceController.rejectRequest
);

module.exports = router;