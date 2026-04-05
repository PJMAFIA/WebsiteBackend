const express = require('express');
const router = express.Router();
const resetController = require('../controllers/resetController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/', protect, resetController.createRequest);
router.get('/my-requests', protect, resetController.getMyRequests);
router.get('/admin/all', protect, adminOnly, resetController.getAllRequests);
router.patch('/:id', protect, adminOnly, resetController.updateStatus);

module.exports = router;