const supabase = require('../config/supabase');
const { sendEmail } = require('../utils/emailService');

class OrderController {

  // Helper: Get localized price
  async _getLocalizedPrice(productId, plan, userId) {
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
    const { data: user } = await supabase.from('users').select('currency').eq('id', userId).maybeSingle();
    
    if (!product || !user) throw new Error("Product or User record not found.");

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

  // 1. Create Order (Manual)
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
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
          screenshotUrl = urlData.publicUrl;
        }
      }

      const { price, product, currency } = await this._getLocalizedPrice(productId, plan, userId);
      const { data: user } = await supabase.from('users').select('email, full_name').eq('id', userId).maybeSingle();

      const { data: newOrder, error } = await supabase.from('orders').insert([{
          user_id: userId, product_id: productId, plan, price, payment_method: paymentMethod, transaction_id: transactionId, payment_screenshot_url: screenshotUrl, status: 'pending'
        }]).select().single();

      if (error) throw error;

      if (process.env.ADMIN_EMAIL) {
        console.log(`📨 Admin Alert: New Order Pending -> ${process.env.ADMIN_EMAIL}`);
        await sendEmail(process.env.ADMIN_EMAIL, `🛒 New Order Pending: ${product.name}`, 
          `<h3>New Manual Order</h3><p>User: ${user?.full_name}</p><p>Price: ${currency} ${price}</p>`);
      }

      res.status(201).json({ status: 'success', data: newOrder });

    } catch (error) {
      console.error("Order Creation Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 2. Purchase with Wallet
  async purchaseWithWallet(req, res) {
    try {
      console.log("\n⚡ STARTING WALLET PURCHASE...");
      const { productId, plan, promoCode } = req.body;
      const userId = req.user.id;

      let { price, product } = await this._getLocalizedPrice(productId, plan, userId);
      let discountApplied = 0;

      if (promoCode) {
        const { data: promo, error: promoError } = await supabase
          .from('promo_codes')
          .select('*')
          .eq('code', promoCode)
          .eq('is_active', true)
          .single();

        if (promo) {
          const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date();
          const isLimitReached = promo.max_uses !== null && promo.uses_count >= promo.max_uses;

          if (isExpired) return res.status(400).json({ message: 'Promo code has expired.' });
          if (isLimitReached) return res.status(400).json({ message: 'Promo code usage limit reached.' });

          if (promo.type === 'percent') {
            discountApplied = (price * promo.value) / 100;
          } else {
            discountApplied = promo.value;
          }
          
          price = Math.max(0, price - discountApplied);

          const { error: rpcError } = await supabase.rpc('increment_promo_usage', { promo_code: promo.code });
          if (rpcError) {
             console.error("❌ Failed to increment promo usage:", rpcError);
             await supabase.from('promo_codes').update({ uses_count: promo.uses_count + 1 }).eq('id', promo.id);
          }
        }
      }

      const { data: user } = await supabase.from('users').select('balance, email, full_name').eq('id', userId).maybeSingle();
      
      if (!user || Number(user.balance) < price) {
        return res.status(400).json({ message: 'Insufficient wallet balance' });
      }

      const { data: licenseData, error: rpcError } = await supabase.rpc('assign_license_to_user', { 
        p_product_id: productId, p_plan: plan, p_user_id: userId 
      });

      const license = Array.isArray(licenseData) ? licenseData[0] : licenseData;

      if (rpcError || !license || !license.id) {
        return res.status(400).json({ message: `Out of Stock! No unused keys found for ${plan}.` });
      }

      const newBalance = Number(user.balance) - price;
      await supabase.from('users').update({ balance: newBalance }).eq('id', userId);

      const { data: order, error: orderError } = await supabase.from('orders').insert([{
          user_id: userId, 
          product_id: productId, 
          plan, 
          price, 
          payment_method: 'wallet', 
          transaction_id: `WALLET-${Date.now()}`, 
          status: 'completed', 
          license_keys_id: license.id
        }]).select().single();

      if (orderError) throw orderError;

      if (user.email) {
        await sendEmail(user.email, `✅ Order Confirmed: ${product.name}`, 
          `<h3>Thank you for your purchase!</h3><p>Price Paid: ${price}</p><p>Key: ${license.key}</p>`);
      }

      res.status(200).json({ status: 'success', data: order });

    } catch (error) {
      console.error("Wallet Purchase Error:", error.message);
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 3. CLAIM FREE TRIAL
  async claimTrial(req, res) {
    try {
        console.log("🎁 Claiming Free Trial...");
        const { productId } = req.body;
        const userId = req.user.id;

        const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
        if (!product || !product.is_trial) {
            return res.status(400).json({ message: 'This product does not offer a free trial.' });
        }

        const { count, error: countError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('product_id', productId)
            .eq('plan', 'trial'); 

        if (countError) throw countError;
        if (count > 0) {
            return res.status(400).json({ message: 'You have already claimed a free trial for this product.' });
        }

        let requiredPlan = 'trial_1_day';
        const hours = parseInt(product.trial_hours);
        if (hours <= 24) requiredPlan = 'trial_1_day';
        else if (hours <= 48) requiredPlan = 'trial_2_days';
        else if (hours <= 72) requiredPlan = 'trial_3_days';
        else requiredPlan = 'trial_1_day';

        const { data: licenseData, error: rpcError } = await supabase.rpc('assign_license_to_user', { 
            p_product_id: productId.toString(), 
            p_plan: requiredPlan, 
            p_user_id: userId.toString() 
        });

        const license = Array.isArray(licenseData) ? licenseData[0] : licenseData;

        if (rpcError || !license || !license.id) {
            return res.status(400).json({ 
                status: 'error',
                message: `Out of Stock! Please wait for admin to add more ${requiredPlan.replace(/_/g, ' ')} keys.` 
            });
        }

        const { data: order, error: orderError } = await supabase.from('orders').insert([{
            user_id: userId,
            product_id: productId,
            plan: 'trial', 
            price: 0,
            payment_method: 'free_trial',
            transaction_id: `TRIAL-${Date.now()}`,
            status: 'completed',
            license_keys_id: license.id 
        }]).select().single();

        if (orderError) throw orderError;

        const { data: userProfile } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();
        const finalEmail = userProfile?.email || req.user.email;

        if (finalEmail) {
            await sendEmail(finalEmail, `🎁 Free Trial Started: ${product.name}`, 
                `<h3>Your Free Trial is Active!</h3>
                 <p><strong>Duration:</strong> ${product.trial_hours} Hours</p>
                 <p><strong>License Key:</strong> ${license.key}</p>`);
        }

        res.status(200).json({ status: 'success', data: order, message: 'Trial started successfully!' });

    } catch (error) {
        console.error("Trial Claim Error:", error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // ✅ FIXED: Get My Orders (Forces Foreign Key Join)
  async getMyOrders(req, res) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *, 
          products!orders_product_id_fkey ( 
            name, 
            image_url, 
            download_link, 
            tutorial_video_link, 
            activation_process 
          ), 
          license_obj:licenses!orders_license_keys_id_fkey ( 
            key, 
            status 
          )
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedData = data.map(order => ({
        ...order,
        extracted_license_key: order.license_obj?.key || null 
      }));

      res.status(200).json({ status: 'success', data: mappedData });
    } catch (error) { 
      console.error("Get Orders Error:", error.message);
      res.status(500).json({ status: 'error', message: error.message }); 
    }
  }

  // ✅ FIXED: Admin Get All Orders (Forces Foreign Key Join)
 // ✅ PERMANENT FIX: Manual Data Stitching (Bypasses Schema Cache Error)
  async getAllOrders(req, res) {
    try {
      // 1. Fetch all orders
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      // 2. Fetch all users and products to map them manually
      const { data: users } = await supabase.from('users').select('id, email, full_name, currency');
      const { data: products } = await supabase.from('products').select('id, name');

      // 3. Combine the data in memory
      const mappedData = orders.map(order => {
        const userMatch = users?.find(u => u.id === order.user_id);
        const productMatch = products?.find(p => p.id === order.product_id);
        
        return {
          ...order,
          users: userMatch || { full_name: 'Unknown User', email: 'N/A' },
          products: productMatch || { name: 'Deleted Product' }
        };
      });

      res.status(200).json({ status: 'success', data: mappedData });
    } catch (error) { 
      console.error("Admin Manual Join Error:", error.message);
      res.status(500).json({ status: 'error', message: error.message }); 
    }
  }

  // Update Status
  async updateStatus(req, res) {
    try {
      const { id } = req.params; const { status } = req.body; 
      const { data: currentOrder } = await supabase.from('orders').select('*, users!orders_user_id_fkey(email), products!orders_product_id_fkey(name)').eq('id', id).single();

      if (status === 'rejected') {
        const { data } = await supabase.from('orders').update({ status: 'rejected' }).eq('id', id).select().single();
        return res.status(200).json({ status: 'success', data });
      }

      if (status === 'completed') {
        const { data: licenseData, error: rpcError } = await supabase.rpc('assign_license_to_user', { 
           p_product_id: currentOrder.product_id, p_plan: currentOrder.plan, p_user_id: currentOrder.user_id 
        });

        const license = Array.isArray(licenseData) ? licenseData[0] : licenseData;

        if (!license || !license.id || rpcError) return res.status(400).json({ status: 'error', message: "Out of Stock" });

        const { data: updatedOrder } = await supabase.from('orders').update({ status: 'completed', license_keys_id: license.id }).eq('id', id).select().single();
        
        if (currentOrder.users?.email) {
          await sendEmail(currentOrder.users.email, `✅ Order Approved: ${currentOrder.products?.name}`, `<h3>Key:</h3><p>${license.key}</p>`);
        }
        return res.status(200).json({ status: 'success', data: updatedOrder });
      }
    } catch (error) { res.status(400).json({ status: 'error', message: error.message }); }
  }
}

const controller = new OrderController();
controller.createOrder = controller.createOrder.bind(controller);
controller.purchaseWithWallet = controller.purchaseWithWallet.bind(controller);
controller.claimTrial = controller.claimTrial.bind(controller);
controller.updateStatus = controller.updateStatus.bind(controller);

module.exports = controller;