/*
 * Read-only endpoints for user balance/ledger data. 
 * No user CRUD or user table — userId is an opaque external identifier passed in from the calling system.
 */
const express = require('express');
const router = express.Router();
const LedgerService = require('../services/LedgerService');

router.get('/:id/balance', (req, res) => {
  const { id } = req.params;
  try {
    const balance = LedgerService.getBalanceBreakdown(id);
    res.json(balance);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/ledger', (req, res) => {
  const { id } = req.params;
  try {
    const ledger = LedgerService.getLedger(id);
    res.json(ledger);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
