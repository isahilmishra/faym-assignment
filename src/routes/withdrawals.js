const express = require('express');
const router = express.Router();
const WithdrawalService = require('../services/WithdrawalService');

router.post('/', (req, res) => {
  const { userId, amount } = req.body;
  try {
    const result = WithdrawalService.requestWithdrawal(userId, amount);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/fail', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  try {
    const result = WithdrawalService.failWithdrawal(id, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
