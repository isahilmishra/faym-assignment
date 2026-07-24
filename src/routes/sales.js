const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { randomUUID: uuidv4 } = require('crypto');
const ReconciliationService = require('../services/ReconciliationService');

router.post('/', (req, res) => {
  const { userId, brand, status, earnings } = req.body;
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO sales (id, userId, brand, status, earnings)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, brand, status || 'pending', earnings);

  res.status(201).json({ id, userId, brand, status: status || 'pending', earnings });
});

router.get('/', (req, res) => {
  const { userId, status } = req.query;
  let query = 'SELECT * FROM sales WHERE 1=1';
  const params = [];
  
  if (userId) {
    query += ' AND userId = ?';
    params.push(userId);
  }
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY createdAt DESC';
  
  const sales = db.prepare(query).all(...params);
  res.json(sales);
});

router.post('/:id/reconcile', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    const result = ReconciliationService.reconcileSale(id, status);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
