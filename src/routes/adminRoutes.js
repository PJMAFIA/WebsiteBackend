const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const supabase = require('../config/supabase'); 

// 🛡️ Middleware: All routes below require Login + Admin Role
router.use(protect, adminOnly);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const { data: stats, error } = await supabase
      .from('admin_dashboard_stats')
      .select('*')
      .single();

    if (error) throw error;

    res.json({ status: 'success', data: stats });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ✅ GET Current Banner
router.get('/banner', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_announcements')
      .select('*')
      .eq('id', 1)
      .single();
      
    if (error && error.code !== 'PGRST116') throw error;
    
    // Return default structure if empty
    res.json({ 
      status: 'success', 
      data: data || { 
        message: '', 
        is_active: false, 
        type: 'info',
        action_label: '',
        action_url: '',
        target_audience: 'all',
        allow_dismiss: true,
        start_at: null,
        end_at: null
      } 
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// ✅ POST Update Banner (With New Features)
router.post('/banner', async (req, res) => {
  try {
    const { 
      message, 
      is_active, 
      type, 
      action_label, 
      action_url, 
      target_audience, 
      allow_dismiss, 
      start_at, 
      end_at 
    } = req.body;

    console.log("Saving Banner:", req.body);

    const { data, error } = await supabase
      .from('system_announcements')
      .upsert({ 
        id: 1, 
        message, 
        is_active, 
        type,
        action_label, 
        action_url, 
        target_audience, 
        allow_dismiss, 
        start_at: start_at || null, // Handle empty strings
        end_at: end_at || null,
        updated_at: new Date() // Force update timestamp to reset dismissals if needed
      }, { onConflict: 'id' })
      .select();

    if (error) throw error;

    res.json({ status: 'success', data: data });
  } catch (error) {
    console.error("Banner Save Error:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;