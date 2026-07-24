const db = require('../db/database');
const { randomUUID: uuidv4 } = require('crypto');
const { WITHDRAWAL_COOLDOWN_HOURS } = require('../config/constants');

class WithdrawalService {
  static getAvailableBalance(userId) {
    const row = db.prepare(`
      SELECT SUM(amount) as balance 
      FROM ledger_entries 
      WHERE userId = ?
    `).get(userId);
    return row.balance || 0;
  }

  static requestWithdrawal(userId, amount) {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    const withdrawTx = db.transaction(() => {
      // Check balance
      const balance = WithdrawalService.getAvailableBalance(userId);
      if (amount > balance) {
        throw new Error('Insufficient balance');
      }

      const withdrawalId = uuidv4();

      // We use INSERT ... SELECT with a WHERE NOT EXISTS to enforce atomically
      // that there is no recent withdrawal in case of concurrent requests.
      const result = db.prepare(`
        INSERT INTO withdrawals (id, userId, amount, status, requestedAt)
        SELECT ?, ?, ?, 'completed', CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
          SELECT 1 FROM withdrawals 
          WHERE userId = ? AND status IN ('pending', 'completed') 
          AND requestedAt > datetime('now', '-${WITHDRAWAL_COOLDOWN_HOURS} hours')
        )
      `).run(withdrawalId, userId, amount, userId);

      if (result.changes === 0) {
        throw new Error(`You can only make one withdrawal every ${WITHDRAWAL_COOLDOWN_HOURS} hours`);
      }

      // Record ledger entry
      db.prepare(`
        INSERT INTO ledger_entries (id, userId, type, amount)
        VALUES (?, ?, 'withdrawal', ?)
      `).run(uuidv4(), userId, -amount);

      return {
        id: withdrawalId,
        userId,
        amount,
        status: 'completed'
      };
    });

    return withdrawTx();
  }

  static failWithdrawal(withdrawalId, reason) {
    if (!['cancelled', 'rejected', 'failed'].includes(reason)) {
      throw new Error('Invalid failure reason');
    }

    const failTx = db.transaction(() => {
      const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(withdrawalId);
      
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }

      if (withdrawal.status !== 'pending' && withdrawal.status !== 'completed') {
        throw new Error('Withdrawal is already in a failed or cancelled state');
      }

      // Update withdrawal
      db.prepare(`
        UPDATE withdrawals 
        SET status = ?, completedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(reason, withdrawalId);

      // Reverse ledger entry (credit back to user)
      db.prepare(`
        INSERT INTO ledger_entries (id, userId, type, amount)
        VALUES (?, ?, 'withdrawal_reversal', ?)
      `).run(uuidv4(), withdrawal.userId, withdrawal.amount);

      return {
        id: withdrawalId,
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        status: reason
      };
    });

    return failTx();
  }
}

module.exports = WithdrawalService;
