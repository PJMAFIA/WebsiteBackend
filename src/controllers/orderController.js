const supabase = require('../config/supabase');
const sendEmail = require('../utils/emailService');

class OrderController {

  // Helper: Get localized price
  async _getLocalizedPrice(productId, plan, userId) {
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
    const { data: user } = await supabase.from('users').select('currency').eq('id', userId).single();
    if (!product || !user) throw new Error("Product or User not found");

    const currency = user.currency || 'USD';
    let price = 0;

    if (currency !== 'USD' && product.currency_prices && product.currency_prices[currency]) {
      price = product.currency_prices[currency][plan] || 0;
    }
    if (price === 0) {
      switch (plan) {
        case '1_day': price = product.price_1_day; break;
        case '7_days': price = product.price_7_days; break;
        case '30_days': price = product.price_30_days; break;
        case 'lifetime': price = product.price_lifetime; break;
      }
    }
    return { price, product, currency };
  }

  // 1. Create Order (Manual Upload) -> Notify Admin
  async createOrder(req, res) {
    try {
      console.log("📥 Creating Order (Manual)...");
      const { productId, plan, paymentMethod, transactionId } = req.body;
      const userId = req.user.id;
      const file = req.file;

      if (!productId || !plan) return res.status(400).json({ status: 'error', message: 'Product and Plan are required' });

      let screenshotUrl = null;
      if (file) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const fileName = `order_${Date.now()}_${userId}_${safeName}`;
        const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
        if (!error) {
          const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
          screenshotUrl = urlData.publicUrl;
        }
      }

      const { price, product, currency } = await this._getLocalizedPrice(productId, plan, userId);

      // Fetch user details just for the email body content
      const { data: user } = await supabase.from('users').select('email, full_name').eq('id', userId).single();

      const { data: newOrder, error } = await supabase.from('orders').insert([{
          user_id: userId, product_id: productId, plan, price, payment_method: paymentMethod, transaction_id: transactionId, payment_screenshot_url: screenshotUrl, status: 'pending'
        }]).select().single();

      if (error) throw error;

      // 📧 EMAIL TO ADMIN (Static from .env)
      if (process.env.ADMIN_EMAIL) {
        console.log(`📨 Admin Alert: New Order Pending -> ${process.env.ADMIN_EMAIL}`);
        await sendEmail(
          process.env.ADMIN_EMAIL,
          `🛒 New Order Pending: ${product.name}`,
          `<h3>New Manual Order</h3>
           <p><strong>User:</strong> ${user?.full_name} (${user?.email})</p>
           <p><strong>Product:</strong> ${product.name} (${plan})</p>
           <p><strong>Price:</strong> ${currency} ${price}</p>
           <p>Please check the screenshot in Admin Panel.</p>`
        );
      }

      res.status(201).json({ status: 'success', data: newOrder });

    } catch (error) {
      console.error("Order Creation Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 2. Purchase with Wallet (Atomic) -> Notify User
  async purchaseWithWallet(req, res) {
    try {
      console.log("\n⚡ STARTING WALLET PURCHASE (ATOMIC MODE)...");
      const { productId, plan } = req.body;
      const userId = req.user.id;

      const { price, product } = await this._getLocalizedPrice(productId, plan, userId);

      // Check Balance & Get User Email
      const { data: user } = await supabase.from('users').select('balance, email, full_name').eq('id', userId).single();
      
      if (Number(user.balance) < price) {
        return res.status(400).json({ message: 'Insufficient wallet balance' });
      }

      const { data: license, error: rpcError } = await supabase.rpc('assign_license_to_user', { 
        p_product_id: productId, p_plan: plan, p_user_id: userId 
      });

      if (rpcError || !license) {
        return res.status(400).json({ message: `Out of Stock! No unused keys found for ${plan}.` });
      }

      const newBalance = Number(user.balance) - price;
      await supabase.from('users').update({ balance: newBalance }).eq('id', userId);

      const { data: order, error: orderError } = await supabase.from('orders').insert([{
          user_id: userId, product_id: productId, plan, price, payment_method: 'wallet', 
          transaction_id: `WALLET-${Date.now()}`, status: 'completed', license_keys_id: license.id
        }]).select().single();

      if (orderError) throw orderError;

      // 📧 EMAIL TO USER (Dynamic fetch)
      if (user.email) {
        console.log(`📨 User Notification: Order Complete -> ${user.email}`);
        await sendEmail(
          user.email,
          `✅ Order Confirmed: ${product.name}`,
          `<h3>Thank you for your purchase!</h3>
           <p>Here is your license key for <strong>${product.name}</strong>:</p>
           <div style="background:#f3f4f6; padding:15px; border-radius:5px; font-family:monospace; font-size:16px;">
             ${license.key}
           </div>
           <p>You can download the software from your dashboard.</p>`
        );
      }

      res.status(200).json({ status: 'success', data: order });

    } catch (error) {
      console.error("Wallet Purchase Error:", error.message);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // Getters (Unchanged)
  async getMyOrders(req, res) {
    try {
      const { data, error } = await supabase.from('orders').select(`*, products ( name, image_url, download_link, tutorial_video_link, activation_process ), licenses ( key, status )`).eq('user_id', req.user.id).order('created_at', { ascending: false });
      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
  }

  async getAllOrders(req, res) {
    try {
      const { data, error } = await supabase.from('orders').select(`*, users ( email, full_name ), products ( name )`).order('created_at', { ascending: false });
      if (error) throw error;
      res.status(200).json({ status: 'success', data });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
  }

  // Update Status -> Notify User if Completed
  async updateStatus(req, res) {
    try {
      const { id } = req.params; const { status } = req.body; 
      
      // Fetch order + user email
      const { data: currentOrder } = await supabase.from('orders').select('*, users!inner(email, full_name), products(name)').eq('id', id).single();

      if (status === 'rejected') {
        const { data, error } = await supabase.from('orders').update({ status: 'rejected' }).eq('id', id).select().single();
        if (error) throw error; return res.status(200).json({ status: 'success', data });
      }

      if (status === 'completed') {
        if (!currentOrder) throw new Error("Order not found");

        const { data: license, error: rpcError } = await supabase.rpc('assign_license_to_user', { 
           p_product_id: currentOrder.product_id, p_plan: currentOrder.plan, p_user_id: currentOrder.user_id 
        });

        if (!license || rpcError) return res.status(400).json({ status: 'error', message: `No stock available for '${currentOrder.plan}' plan!` });

        const { data: updatedOrder, error } = await supabase.from('orders').update({ status: 'completed', license_keys_id: license.id }).eq('id', id).select().single();
        if (error) throw error; 

        // 📧 EMAIL TO USER (Dynamic fetch from order relation)
        if (currentOrder.users?.email) {
          console.log(`📨 User Notification: Order Approved -> ${currentOrder.users.email}`);
          await sendEmail(
            currentOrder.users.email,
            `✅ Order Approved: ${currentOrder.products?.name}`,
            `<h3>Your Order is Complete!</h3>
             <p>Your payment for <strong>${currentOrder.products?.name}</strong> has been approved.</p>
             <p><strong>License Key:</strong></p>
             <div style="background:#f3f4f6; padding:15px; border-radius:5px; font-family:monospace; font-size:16px;">
               ${license.key}
             </div>`
          );
        }

        return res.status(200).json({ status: 'success', data: updatedOrder });
      }
    } catch (error) { res.status(400).json({ status: 'error', message: error.message }); }
  }
}

const controller = new OrderController();
controller.createOrder = controller.createOrder.bind(controller);
controller.purchaseWithWallet = controller.purchaseWithWallet.bind(controller);
controller.updateStatus = controller.updateStatus.bind(controller);

module.exports = controller;