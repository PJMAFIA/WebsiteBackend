const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// 1. Get All Products (Public)
router.get('/', productController.getAllProducts);

// 2. Create Product (Admin Only)
router.post(
  '/', 
  protect, 
  adminOnly, 
  upload.array('images'), 
  productController.createProduct
);

// 3. Update Product (Admin Only) - ✅ NEW ROUTE
// Allows updating details AND uploading new images
router.put(
  '/:id',
  protect,
  adminOnly,
  upload.array('images'),
  productController.updateProduct
);

// 4. Delete Product (Admin Only)
router.delete(
  '/:id', 
  protect, 
  adminOnly, 
  productController.deleteProduct
);

module.exports = router;