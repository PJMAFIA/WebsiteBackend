const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class OrderService {
  
  // 1. Create New Order
  async createOrder(userId, data, file) {
    console.log("📝 Creating Order for User:", userId);
    let screenshotUrl = null;

    if (file) {
      try {
        const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '');
        const fileName = `payment-${uuidv4()}-${cleanFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('payment_proofs').upload(fileName, file.buffer, { contentType: file.mimetype });

        if (uploadError) throw new Error(`Upload Failed: ${uploadError.message}`);
        const { data: publicUrlData } = supabase.storage.from('payment_proofs').getPublicUrl(fileName);
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
        order_number: `ORD-${Date.now()}`
      }])
      .select().single();

    if (error) throw new Error(error.message);
    return order;
  }

  // 2. Get User Orders
  async getUserOrders(userId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, products (name, download_link, tutorial_video_link, activation_process), license_keys (license_key)`)
      .eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  // 3. Get All Orders
  async getAllOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, users (email, full_name), products (name)`).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  // 4. Update Order Status
  async updateOrderStatus(orderId, status) {
    console.log(`🔄 Updating Order ${orderId} to ${status}`);

    if (status === 'rejected') {
      const { data, error } = await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId).select().single();
      if (error) throw new Error(error.message);
      return data;
    }

    if (status === 'completed') {
      // A. Get Order details
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) throw new Error('Order not found');

      console.log(`   -> Looking for license: Product ${order.product_id} | Plan: ${order.plan}`);

      // B. Find matching license
      const { data: license, error: licError } = await supabase
        .from('license_keys')
        .select('id, license_key') 
        .eq('product_id', order.product_id)
        .eq('status', 'unused')
        .eq('plan', order.plan) // 🔥 Strict Matching
        .limit(1)
        .maybeSingle();

      if (licError) throw new Error(`DB Error: ${licError.message}`);
      
      if (!license) {
        throw new Error(`No stock available for '${order.plan}' plan! Please add specific keys.`);
      }

      console.log(`   -> Found License: ${license.id}`);

      // C. Assign License
      const { error: assignError } = await supabase
        .from('license_keys')
        .update({ status: 'assigned', assigned_to: order.user_id, assigned_at: new Date() })
        .eq('id', license.id);

      if (assignError) throw new Error(`Assignment Failed: ${assignError.message}`);

      // D. Update Order
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed', license_key_id: license.id })
        .eq('id', orderId).select().single();

      if (updateError) throw new Error(updateError.message);
      
      console.log("✅ Order Approved & Licensed");
      return updatedOrder;
    }
  }
}

module.exports = new OrderService();