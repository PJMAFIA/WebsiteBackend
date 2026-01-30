const balanceService = require('../services/balanceService');

// 1. Create Request
exports.createRequest = async (req, res) => {
  try {
    const requestData = {
      userId: req.user.id,
      amount: parseFloat(req.body.amount),
      paymentMethod: req.body.paymentMethod,
      transactionId: req.body.transactionId,
    };

    // Validate inputs
    if (!requestData.amount || requestData.amount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid amount' });
    }
    if (!requestData.transactionId) {
      return res.status(400).json({ status: 'error', message: 'Transaction ID is required' });
    }

    // Pass data + file to service
    const request = await balanceService.createRequest(requestData, req.file);

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

// 4. Approve
exports.approveRequest = async (req, res) => {
  try {
    await balanceService.approveRequest(req.params.id);
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