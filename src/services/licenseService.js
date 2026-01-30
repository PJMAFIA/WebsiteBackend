const supabase = require('../config/supabase');

class LicenseService {

  // 1. Add Bulk Licenses
  async addLicenses(productId, keys, plan) {
    // Map data to match your EXACT database columns
    const rows = keys.map(k => ({
      product_id: productId,
      license_key: k,
      plan: plan, // ⚠️ Saving the duration is crucial
      status: 'unused'
    }));

    const { data, error } = await supabase
      .from('license_keys')
      .insert(rows)
      .select();

    if (error) {
      console.error('❌ DB Insert Error:', error);
      if (error.code === '23505') throw new Error('One or more license keys already exist in the database.');
      throw new Error(error.message);
    }

    return data;
  }

  // 2. Get License Stats
  async getLicenseStats() {
    const { data, error } = await supabase
      .from('license_keys')
      .select('id, status, product_id, license_key, plan, created_at') 
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  // 3. Delete Single License
  async deleteLicense(id) {
    const { error } = await supabase
      .from('license_keys')
      .delete()
      .eq('id', id)
      .eq('status', 'unused'); 

    if (error) throw new Error(error.message);
    return true; 
  }

  // 4. Delete All Unused Licenses (NEW)
  async deleteAllUnused() {
    // First, count how many we are about to delete (optional, but good for reporting)
    const { count: unusedCount, error: countError } = await supabase
      .from('license_keys')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unused');

    if (countError) throw new Error(countError.message);

    // Perform Delete
    const { error } = await supabase
      .from('license_keys')
      .delete()
      .eq('status', 'unused');

    if (error) throw new Error(error.message);
    
    return unusedCount;
  }
}

module.exports = new LicenseService();