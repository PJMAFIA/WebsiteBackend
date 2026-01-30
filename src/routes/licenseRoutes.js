const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect, adminOnly);

// Get All
router.get('/', licenseController.getAllLicenses);

// Add (Bulk/Single)
router.post('/', licenseController.addLicense);

// ⚠️ IMPORTANT: Put '/unused' BEFORE '/:id' 
// Otherwise Express thinks "unused" is an ID string.
router.delete('/unused', licenseController.deleteUnusedLicenses);

// Delete Single
router.delete('/:id', licenseController.deleteLicense);

module.exports = router;