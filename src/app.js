const express = require('express');
const app = express();

app.use(express.json());

// Routes
app.use('/sales', require('./routes/sales'));
app.use('/payouts', require('./routes/payouts'));
app.use('/users', require('./routes/balance'));
app.use('/withdrawals', require('./routes/withdrawals'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(400).json({ error: err.message });
});

module.exports = app;
