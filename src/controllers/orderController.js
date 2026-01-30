const supabase = require('../config/supabase');

class OrderController {

  // 1. Create Order (User)
  async createOrder(req, res) {
    try {
      console.log("📥 Creating Order...");
      const { productId, plan, paymentMethod, transactionId } = req.body;
      const userId = req.user.id;
      const file = req.file; // This comes from upload.single('paymentScreenshot')

      if (!productId || !plan) {
        return res.status(400).json({ status: 'error', message: 'Product and Plan are required' });
      }

      // --- A. Upload Screenshot to Supabase (If file exists) ---
      let screenshotUrl = null;

      if (file) {
        console.log("📸 Uploading Screenshot:", file.originalname);
        
        // 1. Create unique filename
        const fileName = `order_${Date.now()}_${userId}_${file.originalname.replace(/\s/g, '_')}`;

        // 2. Upload Buffer to 'uploads' bucket
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          console.error("❌ Upload Error:", uploadError);
          throw new Error("Failed to upload payment screenshot");
        }

        // 3. Get Public URL
        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(fileName);
          
        screenshotUrl = urlData.publicUrl;
        console.log("✅ Screenshot URL:", screenshotUrl);
      } else {
        console.warn("⚠️ No screenshot provided");
      }

      // --- B. Get Price & Validate Product ---
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

      // --- C. Insert Order into DB ---
      const { data: newOrder, error } = await supabase
        .from('orders')
        .insert([{
          user_id: userId,
          product_id: productId,
          plan,
          price,
          payment_method: paymentMethod,
          transaction_id: transactionId,
          payment_screenshot_url: screenshotUrl, // ✅ URL is now saved here
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ status: 'success', data: newOrder });

    } catch (error) {
      console.error("Order Creation Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  // 2. Get My Orders (User)
  async getMyOrders(req, res) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products ( name, image_url, download_link, tutorial_video_link, activation_process ),
          licenses ( key, status )
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ status: 'success', data });

    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 3. Get All Orders (Admin)
  async getAllOrders(req, res) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, users ( email, full_name ), products ( name )`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ status: 'success', data });

    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  // 4. Update Status (Admin)
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body; 

      // A. If Rejected
      if (status === 'rejected') {
        const { data, error } = await supabase
          .from('orders')
          .update({ status: 'rejected' })
          .eq('id', id)
          .select().single();
        if (error) throw error;
        return res.status(200).json({ status: 'success', data });
      }

      // B. If Completed
      if (status === 'completed') {
        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) throw new Error("Order not found");

        if (order.status === 'completed') {
             return res.status(200).json({ status: 'success', data: order, message: 'Already completed' });
        }

        // Search for license matching Plan
        const { data: license } = await supabase
          .from('licenses')
          .select('id')
          .eq('product_id', order.product_id)
          .eq('status', 'unused')
          .eq('plan', order.plan) // Strict Plan Match
          .limit(1)
          .maybeSingle();

        if (!license) {
          return res.status(400).json({ 
            status: 'error', 
            message: `No stock available for '${order.plan}' plan! Add unused ${order.plan} keys first.` 
          });
        }

        // Assign License
        const { error: licError } = await supabase
          .from('licenses')
          .update({ 
            status: 'assigned', 
            assigned_to: order.user_id,
            assigned_at: new Date().toISOString()
          })
          .eq('id', license.id);
        
        if (licError) throw licError;

        // Complete Order
        const { data: updatedOrder, error: ordError } = await supabase
          .from('orders')
          .update({ 
            status: 'completed', 
            license_keys_id: license.id 
          })
          .eq('id', id)
          .select()
          .single();

        if (ordError) throw ordError;

        return res.status(200).json({ status: 'success', data: updatedOrder });
      }

    } catch (error) {
      console.error("Update Status Error:", error.message);
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
}

module.exports = new OrderController();