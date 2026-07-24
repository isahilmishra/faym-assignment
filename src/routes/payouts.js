const express = require('express');
const router = express.Router();
const AdvancePayoutService = require('../services/AdvancePayoutService');

router.post('/advance/run', (req, res) => {
  try {
    const result = AdvancePayoutService.runAdvancePayoutJob();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
