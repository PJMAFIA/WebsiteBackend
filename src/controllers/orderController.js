const supabase = require('../config/supabase');

class OrderController {

  // 1. Create Order (Manual Upload) - No changes here
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
        if (uploadError) throw new Error("Failed to upload payment screenshot");
        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
        screenshotUrl = urlData.publicUrl;
      }

      const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
      if (!product) return res.status(404).json({ status: 'error', message: 'Product not found' });

      let price = 0;
      switch (plan) {
        case '1_day': price = product.price_1_day; break;
        case '7_days': price = product.price_7_days; break;
        case '30_days': price = product.price_30_days; break;
        case 'lifetime': price = product.price_lifetime; break;
        default: return res.status(400).json({ status: 'error', message: 'Invalid Plan' });
      }

      const { data: newOrder, error } = await supabase.from('orders').insert([{
          user_id: userId, product_id: productId, plan, price, payment_method: paymentMethod, transaction_id: transactionId, payment_screenshot_url: screenshotUrl, status: 'pending'
        }]).select().single();

      if (error) throw error;
      res.status(201).json({ status: 'success', data: newOrder });

    } catch (error) {
      console.error("Order Creation Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 🔥 2. Purchase with Wallet (ATOMIC VERSION - NO DUPLICATES)
  async purchaseWithWallet(req, res) {
    try {
      console.log("\n⚡ STARTING WALLET PURCHASE (ATOMIC MODE)...");
      const { productId, plan } = req.body;
      const userId = req.user.id;

      // A. Get Product
      const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
      if (!product) return res.status(404).json({ message: 'Product not found' });

      // B. Calculate Price
      let price = 0;
      switch (plan) {
        case '1_day': price = product.price_1_day; break;
        case '7_days': price = product.price_7_days; break;
        case '30_days': price = product.price_30_days; break;
        case 'lifetime': price = product.price_lifetime; break;
        default: return res.status(400).json({ message: 'Invalid Plan' });
      }

      // C. Check Balance
      const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
      if (!user) return res.status(404).json({ message: 'User not found' });
      
      if (Number(user.balance) < price) {
        return res.status(400).json({ message: 'Insufficient wallet balance' });
      }

      // D. Find AND Assign License (One Step)
      console.log("🔍 Calling Atomic DB Function: assign_license_to_user...");
      
      // ✅ This function now takes the User ID too, so it can assign immediately
      const { data: license, error: rpcError } = await supabase
        .rpc('assign_license_to_user', { 
          p_product_id: productId, 
          p_plan: plan,
          p_user_id: userId 
        });

      if (rpcError) {
        console.error("❌ RPC Error:", rpcError);
        return res.status(500).json({ message: "Database Error: " + rpcError.message });
      }

      if (!license) {
        console.log("❌ Result: OUT OF STOCK.");
        return res.status(400).json({ message: `Out of Stock! No unused keys found for ${plan}.` });
      }

      console.log(`✅ SUCCESS: Atomically Assigned License ID: ${license.id}`);
      // Note: We don't need to manually update 'licenses' table anymore. It's done.

      // E. Deduct Money
      const newBalance = Number(user.balance) - price;
      const { error: balanceError } = await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
      
      if (balanceError) throw new Error("Failed to deduct balance");

      // G. Create Completed Order
      // We use license.id which was returned from our atomic function
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: userId,
          product_id: productId,
          plan,
          price,
          payment_method: 'wallet',
          transaction_id: `WALLET-${Date.now()}`,
          status: 'completed',
          license_keys_id: license.id // Link the key we just secured
        }])
        .select().single();

      if (orderError) {
        console.error("❌ Order Creation Failed:", orderError);
        throw orderError;
      }

      console.log("✅ Wallet Purchase Successful!");
      res.status(200).json({ status: 'success', data: order });

    } catch (error) {
      console.error("Wallet Purchase Error:", error.message);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // ... (Keep existing getMyOrders, getAllOrders, updateStatus functions) ...
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

  async updateStatus(req, res) {
    try {
      const { id } = req.params; const { status } = req.body; 
      if (status === 'rejected') {
        const { data, error } = await supabase.from('orders').update({ status: 'rejected' }).eq('id', id).select().single();
        if (error) throw error; return res.status(200).json({ status: 'success', data });
      }
      if (status === 'completed') {
        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) throw new Error("Order not found");
        
        // Note: For manual admin approval, we can use the same atomic logic or keep it manual.
        // Keeping it consistent:
        const { data: license, error: rpcError } = await supabase.rpc('assign_license_to_user', { 
           p_product_id: order.product_id, 
           p_plan: order.plan,
           p_user_id: order.user_id 
        });

        if (!license || rpcError) return res.status(400).json({ status: 'error', message: `No stock available for '${order.plan}' plan!` });

        const { data: updatedOrder, error } = await supabase.from('orders').update({ status: 'completed', license_keys_id: license.id }).eq('id', id).select().single();
        if (error) throw error; return res.status(200).json({ status: 'success', data: updatedOrder });
      }
    } catch (error) { res.status(400).json({ status: 'error', message: error.message }); }
  }
}

module.exports = new OrderController();