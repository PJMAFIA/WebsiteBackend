const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class OrderService {
  
  // 1. Create New Order (Manual)
  async createOrder(userId, data, file) {
    let screenshotUrl = null;

    if (file) {
      try {
        const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '');
        const fileName = `payment-${uuidv4()}-${cleanFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('uploads') // Ensure bucket name matches controller
          .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw new Error(`Upload Failed: ${uploadError.message}`);
        const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
        screenshotUrl = publicUrlData.publicUrl;
      } catch (err) {
        console.error("❌ Upload Exception:", err.message);
        throw err;
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        user_id: userId,
        product_id: data.productId,
        plan: data.plan,
        price: parseFloat(data.price),
        payment_method: data.paymentMethod,
        transaction_id: data.transactionId,
        payment_screenshot_url: screenshotUrl,
        status: 'pending',
      }])
      .select().single();

    if (error) throw new Error(error.message);
    return order;
  }

  // 2. Create Wallet Order (Instant)
  async createWalletOrder(userId, productId, plan, price, licenseId) {
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        user_id: userId,
        product_id: productId,
        plan: plan,
        price: parseFloat(price),
        payment_method: 'wallet',
        transaction_id: `WALLET-${Date.now()}`,
        status: 'completed',
        license_keys_id: licenseId
      }])
      .select().single();

    if (error) throw new Error(error.message);
    return order;
  }

  // 3. Get User Orders
  async getUserOrders(userId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, products (name, download_link, tutorial_video_link, activation_process), licenses (key)`)
      .eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  // 4. Get All Orders
  async getAllOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, users (email, full_name), products (name)`).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new OrderService();