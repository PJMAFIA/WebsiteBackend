const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController'); // ✅ Uses the new Controller
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Public Route (View Products)
router.get('/', productController.getAllProducts);

// Admin Routes (Protected)
router.post(
  '/',
  protect,
  adminOnly,
  upload.single('image'), // ✅ Matches frontend 'image' field
  productController.createProduct
);

router.delete(
  '/:id',
  protect,
  adminOnly,
  productController.deleteProduct
);

module.exports = router;