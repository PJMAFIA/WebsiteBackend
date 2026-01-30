const supabase = require('../config/supabase');

class LicenseController {

  // 1. Get All Licenses (Admin)
  async getAllLicenses(req, res) {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select(`
          *,
          products ( name ),
          users ( email, full_name )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json({ status: 'success', data });

    } catch (error) {
      console.error("Fetch Licenses Error:", error.message);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 2. Add Licenses (Bulk or Single)
  async addLicense(req, res) {
    try {
      // ✅ FIX: Extract 'keys' (Array) instead of 'key' (String)
      const { productId, keys, plan } = req.body;

      if (!productId || !keys || !Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Product ID and at least one Key are required' });
      }

      // Prepare array of objects for Supabase
      const rows = keys.map(k => ({
        product_id: productId,
        key: k,
        plan: plan || 'lifetime',
        status: 'unused'
      }));

      const { data, error } = await supabase
        .from('licenses')
        .insert(rows)
        .select();

      if (error) throw error;

      res.status(201).json({ status: 'success', count: data.length, data });

    } catch (error) {
      // Handle Duplicate Key Error
      if (error.code === '23505') {
        return res.status(400).json({ status: 'error', message: 'One or more license keys already exist.' });
      }
      console.error("Add License Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 3. Delete Single License
  async deleteLicense(req, res) {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('licenses').delete().eq('id', id);

      if (error) throw error;
      res.status(200).json({ status: 'success', message: 'License deleted' });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 4. Delete All Unused Licenses (NEW Feature)
  async deleteUnusedLicenses(req, res) {
    try {
      // Count first (optional, for feedback)
      const { count } = await supabase
        .from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unused');

      if (count === 0) {
        return res.status(200).json({ status: 'success', message: 'No unused keys found.' });
      }

      // Delete
      const { error } = await supabase
        .from('licenses')
        .delete()
        .eq('status', 'unused');

      if (error) throw error;

      res.status(200).json({ status: 'success', message: `Successfully deleted ${count} unused keys.` });

    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new LicenseController();