const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promoController');

// ⚠️ Check your folder name: 'middleware' vs 'middlewares'
const { protect, adminOnly } = require('../middlewares/authMiddleware'); 

router.post('/validate', protect, promoController.validatePromo);

// Admin Only
router.get('/', protect, adminOnly, promoController.getAllPromos);
router.post('/', protect, adminOnly, promoController.createPromo);
router.put('/:id', protect, adminOnly, promoController.updatePromo); // ✅ New Route
router.delete('/:id', protect, adminOnly, promoController.deletePromo);

module.exports = router;