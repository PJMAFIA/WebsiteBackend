const supabase = require('../config/supabase');
const sendEmail = require('../utils/emailService');
const { sendDiscordWebhook } = require('../utils/discordService'); // ✅ IMPORTED DISCORD SERVICE

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

      // Get Product Name and User Email for notifications
      const { data: product } = await supabase.from('products').select('name').eq('id', productId).maybeSingle();
      const { data: user } = await supabase.from('users').select('email, full_name').eq('id', userId).maybeSingle();

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

      // Notify Admin Email
      if (process.env.ADMIN_EMAIL) {
        try {
            await sendEmail(
              process.env.ADMIN_EMAIL,
              '🔐 New Credential Reset Request',
              `<h3>User requested a reset</h3><p>User ID: ${userId}</p><p>Check Admin Dashboard.</p>`
            );
        } catch (emailErr) { console.error("⚠️ Failed to send Admin Alert:", emailErr.message); }
      }

      // ✅ DISCORD WEBHOOK: HWID/Credential Reset Request
      try {
        await sendDiscordWebhook([{
          title: "🔐 New Reset Request (HWID/Creds)",
          description: "A user is requesting a credentials or HWID reset for their software.",
          color: 15158332, // Red/Pink
          fields: [
            { name: "User", value: `${user?.full_name || 'Unknown'} (${user?.email || 'N/A'})`, inline: false },
            { name: "Product", value: product?.name || 'Unknown Product', inline: true },
            { name: "Order ID", value: `\`${orderId}\``, inline: true }
          ],
          footer: { text: "Review and process in the Admin Reset panel" },
          timestamp: new Date().toISOString()
        }]);
      } catch (discordError) {
        console.error("⚠️ Discord Webhook Failed on Reset Request:", discordError.message);
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
      const { data, error } = await supabase.from('credential_requests').select('*, users(email, full_name), products(name)').order('created_at', { ascending: false });
      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
  }

  // 3. Get My Requests (User)
  async getMyRequests(req, res) {
    try {
      const { data, error } = await supabase.from('credential_requests').select('*, products(name)').eq('user_id', req.user.id).order('created_at', { ascending: false });
      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
  }

  // 4. Update Status (Admin)
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, adminResponse } = req.body; 

      const { data: updated, error } = await supabase
        .from('credential_requests')
        .update({ status, admin_response: adminResponse, updated_at: new Date() })
        .eq('id', id)
        .select('*, users(email, full_name), products(name)') 
        .single();

      if (error) throw error;

      // ✅ Email Notification
      if (updated.users?.email) {
        const subject = status === 'approved' ? '✅ Credentials Reset Approved' : '❌ Request Rejected';
        const body = status === 'approved' 
          ? `<p>Your credential reset request has been approved.</p><p><strong>Admin Note:</strong> ${adminResponse || 'Done.'}</p>`
          : `<p>Your request was rejected.</p><p>Reason: ${adminResponse || 'No reason provided.'}</p>`;
        
        try {
          await sendEmail(updated.users.email, subject, body);
        } catch (emailErr) {
          console.error("⚠️ Failed to send Approval Email:", emailErr.message);
        }
      }

      // ✅ DISCORD WEBHOOK: Admin Processed Request
      try {
        const isApproved = status === 'approved';
        await sendDiscordWebhook([{
          title: isApproved ? "✅ Reset Request Approved" : "❌ Reset Request Rejected",
          description: `An Admin has ${isApproved ? 'approved' : 'rejected'} a reset request.`,
          color: isApproved ? 5763719 : 15548997, // Green for Approve, Red for Reject
          fields: [
            { name: "User", value: updated.users?.full_name || updated.users?.email || 'Unknown', inline: true },
            { name: "Product", value: updated.products?.name || 'Unknown Product', inline: true },
            { name: "Admin Note", value: adminResponse || 'No note provided', inline: false }
          ],
          timestamp: new Date().toISOString()
        }]);
      } catch (discordError) {
        console.error("⚠️ Discord Webhook Failed on Admin Update:", discordError.message);
      }

      res.status(200).json({ status: 'success', data: updated });
    } catch (error) { 
      res.status(500).json({ status: 'error', message: error.message }); 
    }
  }
}

module.exports = new ResetController();