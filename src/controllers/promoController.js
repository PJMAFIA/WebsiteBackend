const supabase = require('../config/supabase');

class PromoController {
  
  // Validate Code (Public)
  async validatePromo(req, res) {
    try {
      const { code, cartTotal } = req.body;
      
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error || !promo) {
        return res.status(404).json({ status: 'error', message: 'Invalid or inactive promo code' });
      }

      // Check Expiry
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        return res.status(400).json({ status: 'error', message: 'Promo code has expired' });
      }

      // Check Max Uses
      if (promo.max_uses !== null) {
          const maxUses = Number(promo.max_uses);
          const currentUses = Number(promo.uses_count);
          if (currentUses >= maxUses) return res.status(400).json({ status: 'error', message: 'Promo code usage limit reached' });
      }

      // Calculate Discount
      let discountAmount = 0;
      if (promo.type === 'percent') {
        discountAmount = (cartTotal * promo.value) / 100;
      } else {
        discountAmount = promo.value;
      }

      discountAmount = Math.min(discountAmount, cartTotal);

      res.status(200).json({ 
        status: 'success', 
        data: { isValid: true, discountAmount, finalPrice: cartTotal - discountAmount, code: promo.code } 
      });

    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // Create Promo (Admin)
  async createPromo(req, res) {
    try {
      const { code, type, value, max_uses, expires_at } = req.body;
      const { data, error } = await supabase
        .from('promo_codes')
        .insert([{ code, type, value: Number(value), max_uses: max_uses ? Number(max_uses) : null, expires_at }])
        .select().single();

      if (error) throw error;
      res.status(201).json({ status: 'success', data });
    } catch (error) { res.status(400).json({ status: 'error', message: error.message }); }
  }

  // ✅ Update Promo (Admin) - NEW
  async updatePromo(req, res) {
    try {
      const { id } = req.params;
      const { code, type, value, max_uses, expires_at } = req.body;

      const { data, error } = await supabase
        .from('promo_codes')
        .update({ 
            code, 
            type, 
            value: Number(value), 
            max_uses: max_uses ? Number(max_uses) : null, 
            expires_at 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // Get All (Admin)
  async getAllPromos(req, res) {
    try {
      const { data, error } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
  }

  // Delete (Admin)
  async deletePromo(req, res) {
    try {
      const { id } = req.params;
      const { error } = await supabase.from('promo_codes').delete().eq('id', id);
      if (error) throw error;
      res.status(200).json({ status: 'success', message: 'Promo deleted' });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
  }
}

module.exports = new PromoController();