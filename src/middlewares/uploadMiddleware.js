const multer = require('multer');

// Store file in memory (RAM) so we can upload directly to Supabase
const storage = multer.memoryStorage();

// Filter to ensure only images are uploaded
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit: 5MB
  },
  fileFilter: fileFilter,
});

module.exports = upload;