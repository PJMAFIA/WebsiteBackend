const balanceService = require('../services/balanceService');
const { sendEmail } = require('../utils/emailService'); 
const supabase = require('../config/supabase');
const { sendDiscordWebhook } = require('../utils/discordService'); // ✅ IMPORTED DISCORD SERVICE

// 1. Create Request (User submits -> Notify Admin)
exports.createRequest = async (req, res) => {
  try {
    const userId = req.user.id; 

    // 🔍 SELF-HEALING FIX: Ensure user exists in 'public.users' before linking
    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

    if (!existingUser) {
        console.log(`⚠️ User ${userId} missing from public table. Auto-creating...`);
        const { error: upsertError } = await supabase.from('users').upsert({
            id: userId,
            email: req.user.email,
            full_name: req.user.user_metadata?.full_name || 'User',
            role: 'user',
            balance: 0,
            currency: 'USD'
        });
        if (upsertError) {
            console.error("❌ Failed to auto-create user:", upsertError);
            return res.status(500).json({ status: 'error', message: 'User profile sync failed. Please contact support.' });
        }
    }

    const requestData = {
      userId: userId,
      amount: parseFloat(req.body.amount),
      currency: req.body.currency || 'USD',
      paymentMethod: req.body.paymentMethod,
      transactionId: req.body.transactionId,
    };

    if (!requestData.amount || requestData.amount <= 0) return res.status(400).json({ status: 'error', message: 'Invalid amount' });
    if (!requestData.transactionId) return res.status(400).json({ status: 'error', message: 'Transaction ID is required' });

    const request = await balanceService.createRequest(requestData, req.file);

    // 📧 EMAIL TO ADMIN
    if (process.env.ADMIN_EMAIL) {
      await sendEmail(
        process.env.ADMIN_EMAIL,
        '💰 New Balance Request Pending',
        `<h3>New Top-up Request</h3>
         <p><strong>User ID:</strong> ${requestData.userId}</p>
         <p><strong>Amount:</strong> ${requestData.currency} ${requestData.amount}</p>
         <p><strong>Transaction ID:</strong> ${requestData.transactionId}</p>`
      );
    }

    // ✅ DISCORD WEBHOOK: Wallet Top-Up Request
    await sendDiscordWebhook([{
      title: "💰 New Wallet Top-up Request",
      description: "A user has submitted a manual payment to add funds to their wallet.",
      color: 16753920, // Gold/Orange
      fields: [
        { name: "User Email", value: req.user.email || 'Unknown', inline: false },
        { name: "Amount", value: `${requestData.currency} ${requestData.amount}`, inline: true },
        { name: "Payment Method", value: requestData.paymentMethod.toUpperCase().replace('_', ' '), inline: true },
        { name: "Transaction ID", value: `\`${requestData.transactionId}\``, inline: false }
      ],
      footer: { text: "Review and approve in the Admin Dashboard" },
      timestamp: new Date().toISOString()
    }]);

    res.status(201).json({ status: 'success', message: 'Balance request submitted successfully', data: request });
  } catch (error) {
    console.error("Balance Request Error:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getUserRequests = async (req, res) => {
  try {
    const requests = await balanceService.getUserRequests(req.user.id);
    res.status(200).json({ status: 'success', data: requests });
  } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.getAllRequests = async (req, res) => {
  try {
    const requests = await balanceService.getAllRequests();
    res.status(200).json({ status: 'success', data: requests });
  } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.approveRequest = async (req, res) => {
  try {
    await balanceService.approveRequest(req.params.id);
    const { data: reqData } = await supabase.from('balance_requests').select('amount, currency, users!inner(email, full_name)').eq('id', req.params.id).single();
    if (reqData && reqData.users?.email) {
      await sendEmail(reqData.users.email, '✅ Balance Added to Your Wallet', `<p>Your deposit of ${reqData.currency} ${reqData.amount} has been approved.</p>`);
    }
    res.status(200).json({ status: 'success', message: 'Request approved' });
  } catch (error) { res.status(400).json({ status: 'error', message: error.message }); }
};

exports.rejectRequest = async (req, res) => {
  try {
    await balanceService.rejectRequest(req.params.id);
    res.status(200).json({ status: 'success', message: 'Request rejected' });
  } catch (error) { res.status(400).json({ status: 'error', message: error.message }); }
};