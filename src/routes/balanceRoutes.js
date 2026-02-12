const express = require('express');
const router = express.Router();
const balanceController = require('../controllers/balanceController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const axios = require('axios');
const supabase = require('../config/supabase'); 

// --- 💰 OXAPAY AUTOMATION ROUTES ---

// 1. Create Crypto Invoice (Frontend calls this)
router.post('/oxapay/create-payment', protect, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    console.log("🔹 Creating Payment for:", amount); // Debug Log

    // 1. Validate Amount (Must be a Number)
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount < 2) { 
      return res.status(400).json({ status: 'error', message: 'Minimum amount is $2' });
    }

    // 2. Validate API Key
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;
    if (!merchantKey) {
      console.error("❌ ERROR: OXAPAY_MERCHANT_KEY is missing in .env file!");
      return res.status(500).json({ status: 'error', message: 'Server Config Error: Missing Merchant Key' });
    }

    // 3. Prepare Payload
    const payload = {
      merchant: merchantKey,
      amount: numericAmount, // ✅ Forced to Number
      currency: 'USD',
      life_time: 30,
      fee_paid_by_payer: 0,
      under_paid_cover: 2.5,
      callbackUrl: `${process.env.BACKEND_URL}/api/balance/oxapay/webhook`,
      returnUrl: `${process.env.FRONTEND_URL}/dashboard`,
      description: `Topup: ${userId}`,
      orderId: userId
    };

    console.log("📤 Sending Payload to Oxapay:", JSON.stringify(payload, null, 2));

    // 4. Send Request
    const response = await axios.post('https://api.oxapay.com/merchants/request', payload);

    // 5. Check Response
    if (response.data.result !== 100) {
      console.error('❌ Oxapay API Error:', response.data);
      return res.status(500).json({ status: 'error', message: response.data.message || 'Payment Gateway Error' });
    }

    console.log("✅ Payment Link Created:", response.data.payLink);

    res.json({
      status: 'success',
      payUrl: response.data.payLink
    });

  } catch (error) {
    console.error('❌ Create Invoice Error:', error.message);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// 2. Webhook (Oxapay calls this automatically)
router.post('/oxapay/webhook', async (req, res) => {
  try {
    console.log("🔔 Webhook Received:", req.body);
    const { status, orderId, amount, txID } = req.body;
    
    if (status === 'Paid' || status === 'Confirm') {
      const userId = orderId; 

      // Check for duplicates
      const { data: existingTx } = await supabase
        .from('balance_requests')
        .select('*')
        .eq('transaction_id', txID) 
        .single();

      if (existingTx) {
        console.log("⚠️ Transaction already processed:", txID);
        return res.status(200).json({ message: 'Already processed' });
      }

      // Fetch User Balance
      const { data: userData } = await supabase.from('users').select('balance').eq('id', userId).single();
      const newBalance = (userData?.balance || 0) + parseFloat(amount);

      // Update Balance
      await supabase.from('users').update({ balance: newBalance }).eq('id', userId);

      // Log Transaction
      await supabase.from('balance_requests').insert({
        user_id: userId,
        amount: amount,
        payment_method: 'crypto_auto',
        status: 'approved', 
        transaction_id: txID, 
        screenshot_url: 'AUTO_GENERATED_OXAPAY'
      });

      console.log(`✅ Auto-Credited $${amount} to User ${userId}`);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('❌ Webhook Error:', error);
    res.status(500).json({ status: 'error' });
  }
});

// --- EXISTING MANUAL ROUTES ---
router.post('/', protect, upload.single('paymentScreenshot'), balanceController.createRequest);
router.get('/my-requests', protect, balanceController.getUserRequests);
router.get('/admin/all', protect, adminOnly, balanceController.getAllRequests);
router.patch('/:id/approve', protect, adminOnly, balanceController.approveRequest);
router.patch('/:id/reject', protect, adminOnly, balanceController.rejectRequest);

module.exports = router;