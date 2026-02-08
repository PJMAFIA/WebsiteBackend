const supabase = require('../config/supabase');
const sendEmail = require('../utils/emailService');

class ResetController {
  
  // 1. Create Request (User)
  async createRequest(req, res) {
    try {
      const { productId, orderId, username, password } = req.body;
      const userId = req.user.id;

      if (!productId || !orderId || !username || !password) {
        return res.status(400).json({ status: 'error', message: 'All fields required' });
      }

      // Verify ownership
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .eq('user_id', userId)
        .eq('product_id', productId)
        .single();

      if (!order) return res.status(403).json({ status: 'error', message: 'Order not found' });

      // Insert Request
      const { data, error } = await supabase
        .from('credential_requests')
        .insert([{
          user_id: userId,
          product_id: productId,
          order_id: orderId,
          username,
          password,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;

      // Notify Admin
      if (process.env.ADMIN_EMAIL) {
        try {
            await sendEmail(
              process.env.ADMIN_EMAIL,
              '🔐 New Credential Reset Request',
              `<h3>User requested a reset</h3><p>User ID: ${userId}</p><p>Check Admin Dashboard.</p>`
            );
        } catch (emailErr) {
            console.error("⚠️ Failed to send Admin Alert:", emailErr.message);
        }
      }

      res.status(201).json({ status: 'success', data });

    } catch (error) {
      console.error("❌ Create Request Error:", error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 2. Get All Requests (Admin)
  async getAllRequests(req, res) {
    try {
      const { data, error } = await supabase
        .from('credential_requests')
        .select('*, users(email, full_name), products(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      console.error("❌ Get All Requests Error:", error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 3. Get My Requests (User)
  async getMyRequests(req, res) {
    try {
      const { data, error } = await supabase
        .from('credential_requests')
        .select('*, products(name)')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      console.error("❌ Get My Requests Error:", error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 4. Update Status (Admin)
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, adminResponse } = req.body; 

      console.log(`🔄 Updating Request ${id} to ${status}...`);

      // 1. Perform Update
      const { data: updated, error } = await supabase
        .from('credential_requests')
        .update({ 
            status, 
            admin_response: adminResponse, 
            updated_at: new Date() 
        })
        .eq('id', id)
        .select('*, users(email)') // Fetch user email
        .single();

      if (error) throw error;

      // 2. Notify User
      // 🚨 CHECK TERMINAL: This log shows EXACTLY who gets the email
      if (updated.users?.email) {
        console.log(`📧 Sending notification to USER EMAIL: ${updated.users.email}`);
        
        const subject = status === 'approved' ? '✅ Credentials Reset Approved' : '❌ Request Rejected';
        const body = status === 'approved' 
          ? `<p>Your credential reset request has been approved.</p><p><strong>Admin Note:</strong> ${adminResponse || 'Done.'}</p>`
          : `<p>Your request was rejected.</p><p>Reason: ${adminResponse || 'No reason provided.'}</p>`;
        
        await sendEmail(updated.users.email, subject, body);
      } else {
        console.warn("⚠️ No user email found in database for this request.");
      }

      res.status(200).json({ status: 'success', data: updated });

    } catch (error) {
      console.error("🔥 Update Status Error:", error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new ResetController();