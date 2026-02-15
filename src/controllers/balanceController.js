const balanceService = require('../services/balanceService');
const { sendEmail } = require('../utils/emailService'); 
const supabase = require('../config/supabase');

// 1. Create Request (User submits -> Notify Admin)
exports.createRequest = async (req, res) => {
  try {
    const userId = req.user.id; // From Auth Token

    // 🔍 SELF-HEALING FIX: Ensure user exists in 'public.users' before linking
    // This prevents the "violates foreign key constraint" error.
    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

    if (!existingUser) {
        console.log(`⚠️ User ${userId} missing from public table. Auto-creating...`);
        
        // Upsert the user to satisfy the Foreign Key
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

    // Now proceed with creating the request
    const requestData = {
      userId: userId,
      amount: parseFloat(req.body.amount),
      currency: req.body.currency || 'USD',
      paymentMethod: req.body.paymentMethod,
      transactionId: req.body.transactionId,
    };

    if (!requestData.amount || requestData.amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid amount' });
    }
    if (!requestData.transactionId) {
      return res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
    }

    const request = await balanceService.createRequest(requestData, req.file);

    // 📧 EMAIL TO ADMIN
    if (process.env.ADMIN_EMAIL) {
      console.log(`📨 Admin Alert: New Balance Request -> ${process.env.ADMIN_EMAIL}`);
      await sendEmail(
        process.env.ADMIN_EMAIL,
        '💰 New Balance Request Pending',
        `<h3>New Top-up Request</h3>
         <p><strong>User ID:</strong> ${requestData.userId}</p>
         <p><strong>Amount:</strong> ${requestData.currency} ${requestData.amount}</p>
         <p><strong>Transaction ID:</strong> ${requestData.transactionId}</p>
         <p>Please check the admin dashboard to approve.</p>`
      );
    }

    res.status(201).json({
      status: 'success',
      message: 'Balance request submitted successfully',
      data: request
    });
  } catch (error) {
    console.error("Balance Request Error:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Get User Requests
exports.getUserRequests = async (req, res) => {
  try {
    const requests = await balanceService.getUserRequests(req.user.id);
    res.status(200).json({ status: 'success', data: requests });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Get All Requests (Admin)
exports.getAllRequests = async (req, res) => {
  try {
    const requests = await balanceService.getAllRequests();
    res.status(200).json({ status: 'success', data: requests });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// 4. Approve (Admin approves -> Notify User)
exports.approveRequest = async (req, res) => {
  try {
    await balanceService.approveRequest(req.params.id);

    // 📧 EMAIL TO USER
    const { data: reqData } = await supabase
      .from('balance_requests')
      .select('amount, currency, users!inner(email, full_name)')
      .eq('id', req.params.id)
      .single();

    if (reqData && reqData.users?.email) {
      const userEmail = reqData.users.email;
      console.log(`📨 User Notification: Balance Approved -> ${userEmail}`);
      
      await sendEmail(
        userEmail,
        '✅ Balance Added to Your Wallet',
        `<h3>Payment Approved</h3>
         <p>Hi ${reqData.users.full_name},</p>
         <p>Your deposit of <strong>${reqData.currency} ${reqData.amount}</strong> has been approved and added to your wallet.</p>
         <p>Happy Shopping!</p>`
      );
    }

    res.status(200).json({ status: 'success', message: 'Request approved' });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// 5. Reject
exports.rejectRequest = async (req, res) => {
  try {
    await balanceService.rejectRequest(req.params.id);
    res.status(200).json({ status: 'success', message: 'Request rejected' });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};