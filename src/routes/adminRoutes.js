const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const supabase = require('../config/supabase'); // Directly query for stats

// 🛡️ Middleware: All routes below require Login + Admin Role
router.use(protect, adminOnly);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    // Fetch stats using the View we created in SQL
    const { data: stats, error } = await supabase
      .from('admin_dashboard_stats')
      .select('*')
      .single();

    if (error) throw error;

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;