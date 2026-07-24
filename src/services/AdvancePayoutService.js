const db = require('../db/database');
const { randomUUID: uuidv4 } = require('crypto');
const { ADVANCE_PAYOUT_PERCENTAGE } = require('../config/constants');

class AdvancePayoutService {
  static runAdvancePayoutJob() {
    // Finds all pending sales with no existing Advance record
    const getPendingSalesQuery = db.prepare(`
      SELECT s.* FROM sales s
      LEFT JOIN advances a ON s.id = a.saleId
      WHERE s.status = 'pending' AND a.id IS NULL
    `);

    const insertAdvanceStmt = db.prepare(`
      INSERT INTO advances (id, saleId, amount)
      VALUES (?, ?, ?)
    `);

    const insertLedgerStmt = db.prepare(`
      INSERT INTO ledger_entries (id, userId, saleId, type, amount)
      VALUES (?, ?, ?, 'advance', ?)
    `);

    // Using a transaction to process all eligible sales
    const processSales = db.transaction((sales) => {
      let processedCount = 0;
      for (const sale of sales) {
        const advanceAmount = sale.earnings * ADVANCE_PAYOUT_PERCENTAGE;
        
        try {
          // Attempt to insert advance
          insertAdvanceStmt.run(uuidv4(), sale.id, advanceAmount);
          // Attempt to insert ledger entry
          insertLedgerStmt.run(uuidv4(), sale.userId, sale.id, advanceAmount);
          processedCount++;
        } catch (error) {
          // If a UNIQUE constraint on saleId fails, it means another job ran concurrently.
          // We can just ignore and continue to the next sale.
          if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint failed')) {
            continue;
          }
          throw error;
        }
      }
      return processedCount;
    });

    const pendingSales = getPendingSalesQuery.all();
    const processed = processSales(pendingSales);
    return { processed, totalEligible: pendingSales.length };
  }
}

module.exports = AdvancePayoutService;
