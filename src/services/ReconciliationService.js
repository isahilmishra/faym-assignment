const db = require('../db/database');
const { randomUUID: uuidv4 } = require('crypto');

class ReconciliationService {
  static reconcileSale(saleId, newStatus) {
    if (!['approved', 'rejected'].includes(newStatus)) {
      throw new Error('Invalid status for reconciliation');
    }

    const reconcileTx = db.transaction(() => {
      const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      
      if (!sale) {
        throw new Error('Sale not found');
      }

      if (sale.status !== 'pending') {
        throw new Error('Sale has already been reconciled');
      }

      const advance = db.prepare('SELECT * FROM advances WHERE saleId = ?').get(saleId);
      const advancePaid = advance ? advance.amount : 0;

      let finalAdjustmentAmount = 0;
      let ledgerType = '';

      if (newStatus === 'approved') {
        finalAdjustmentAmount = sale.earnings - advancePaid;
        ledgerType = 'final_settlement';
      } else if (newStatus === 'rejected') {
        finalAdjustmentAmount = -advancePaid;
        ledgerType = 'adjustment';
      }

      // Update sale
      const result = db.prepare(`
        UPDATE sales 
        SET status = ?, reconciledAt = CURRENT_TIMESTAMP 
        WHERE id = ? AND status = 'pending'
      `).run(newStatus, saleId);
      
      if (result.changes === 0) {
        throw new Error('Sale was reconciled concurrently');
      }

      // Create ledger entry
      db.prepare(`
        INSERT INTO ledger_entries (id, userId, saleId, type, amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), sale.userId, saleId, ledgerType, finalAdjustmentAmount);

      return {
        saleId,
        newStatus,
        advancePaid,
        finalAdjustmentAmount,
        earnings: sale.earnings
      };
    });

    return reconcileTx();
  }
}

module.exports = ReconciliationService;
