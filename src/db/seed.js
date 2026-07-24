const db = require('./database');
const { randomUUID: uuidv4 } = require('crypto');
const AdvancePayoutService = require('../services/AdvancePayoutService');
const ReconciliationService = require('../services/ReconciliationService');
const LedgerService = require('../services/LedgerService');

function runSeed() {
  // Clear existing data for seed
  db.exec('DELETE FROM ledger_entries; DELETE FROM advances; DELETE FROM withdrawals; DELETE FROM sales;');

  const userId = 'john_doe';

  console.log('Seeding initial sales...');
  // Total earnings = 120
  const salesToInsert = [
    { id: uuidv4(), userId, brand: 'brand_1', status: 'pending', earnings: 40 },
    { id: uuidv4(), userId, brand: 'brand_1', status: 'pending', earnings: 40 },
    { id: uuidv4(), userId, brand: 'brand_1', status: 'pending', earnings: 40 }
  ];

  const insertSale = db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)');
  salesToInsert.forEach(s => insertSale.run(s.id, s.userId, s.brand, s.status, s.earnings));

  console.log('Running advance payout job...');
  AdvancePayoutService.runAdvancePayoutJob();
  const afterAdvanceBalance = LedgerService.getBalance(userId);
  console.log(`Balance after advance (expected ₹12): ₹${afterAdvanceBalance}`);

  console.log('Reconciling sales...');
  // Reject first one
  ReconciliationService.reconcileSale(salesToInsert[0].id, 'rejected');
  // Approve the other two
  ReconciliationService.reconcileSale(salesToInsert[1].id, 'approved');
  ReconciliationService.reconcileSale(salesToInsert[2].id, 'approved');

  const finalBalance = LedgerService.getBalance(userId);
  const breakdown = LedgerService.getBalanceBreakdown(userId);
  
  console.log(`Reconciled Final Payout (expected ₹68): ₹${breakdown.totalSettled}`);
  console.log(`Total Withdrawable Balance (₹12 advance + ₹68 final): ₹${finalBalance}`);

  console.log('\n--- Ledger Breakdown ---');
  console.log(breakdown);

  console.log('\nSeed completed successfully.');
}

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
