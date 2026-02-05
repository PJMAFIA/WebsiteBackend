const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

// ✅ Static Exchange Rates (Must match Frontend for consistency)
const EXCHANGE_RATES = {
  USD: 1,
  GBP: 0.79,
  INR: 83.50,
  PKR: 278.00,
  BDT: 117.00
};

class BalanceService {

  // 1. Create Request
  async createRequest(data, file) {
    let screenshotUrl = null;

    if (file) {
      const fileName = `balance_${uuidv4()}_${file.originalname.replace(/\s/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

      if (uploadError) throw new Error(`Upload Failed: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);
        
      screenshotUrl = publicUrlData.publicUrl;
    }

    const { data: request, error } = await supabase
      .from('balance_requests')
      .insert([{
        user_id: data.userId,
        amount: data.amount,
        currency: data.currency, // ✅ FIX: Save Currency to DB
        payment_method: data.paymentMethod,
        transaction_id: data.transactionId,
        payment_screenshot_url: screenshotUrl,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return request;
  }

  // 2. Get User Requests
  async getUserRequests(userId) {
    const { data, error } = await supabase
      .from('balance_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(req => ({
      id: req.id,
      amount: parseFloat(req.amount),
      currency: req.currency || 'USD', // ✅ Return currency
      paymentMethod: req.payment_method,
      transactionId: req.transaction_id,
      paymentScreenshot: req.payment_screenshot_url,
      status: req.status,
      createdAt: req.created_at,
      processedAt: req.processed_at
    }));
  }

  // 3. Get All Requests (Admin)
  async getAllRequests() {
    const { data, error } = await supabase
      .from('balance_requests')
      .select(`*, users (full_name, email)`)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return data.map(req => ({
      id: req.id,
      userId: req.user_id,
      userName: req.users?.full_name || 'Unknown',
      userEmail: req.users?.email || 'Unknown',
      amount: parseFloat(req.amount),
      currency: req.currency || 'USD', // ✅ Return currency to Admin
      paymentMethod: req.payment_method,
      transactionId: req.transaction_id,
      paymentScreenshot: req.payment_screenshot_url,
      status: req.status,
      createdAt: req.created_at
    }));
  }

  // 4. Approve Request (With Currency Conversion)
  async approveRequest(requestId) {
    console.log(`🚀 STARTING APPROVAL: ${requestId}`);

    // A. Fetch Request Details
    const { data: request, error: reqError } = await supabase
      .from('balance_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !request) throw new Error('Request not found');
    if (request.status === 'approved') throw new Error('Already approved');

    // B. Fetch Current Balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', request.user_id)
      .single();

    if (userError) throw new Error('User not found');

    const oldBalance = parseFloat(user.balance) || 0;
    
    // ✅ FIX: Convert Requested Amount to USD
    // Since user balance is stored in USD, we must convert foreign currency requests.
    const reqAmount = parseFloat(request.amount);
    const reqCurrency = request.currency || 'USD';
    const rate = EXCHANGE_RATES[reqCurrency] || 1;
    
    // Logic: Amount in USD = Amount / Rate
    // Example: 278 PKR / 278 = $1 USD Added
    const amountToAddInUsd = reqAmount / rate;

    console.log(`💱 Converting: ${reqAmount} ${reqCurrency} -> $${amountToAddInUsd.toFixed(2)} USD`);

    const newBalance = oldBalance + amountToAddInUsd;

    // C. Update Balance
    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', request.user_id);

    if (updateError) throw new Error(`DB Write Failed: ${updateError.message}`);

    // D. Mark Request as Approved
    const { error: statusError } = await supabase
      .from('balance_requests')
      .update({ 
        status: 'approved', 
        processed_at: new Date().toISOString() 
      })
      .eq('id', requestId);

    if (statusError) throw new Error(statusError.message);

    console.log("🎉 Approval Complete!");
    return true;
  }

  // 5. Reject Request
  async rejectRequest(requestId) {
    const { error } = await supabase
      .from('balance_requests')
      .update({ 
        status: 'rejected', 
        processed_at: new Date().toISOString() 
      })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) throw new Error(error.message);
    return true;
  }
}

module.exports = new BalanceService();