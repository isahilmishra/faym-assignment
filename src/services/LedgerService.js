const db = require('../db/database');

class LedgerService {
  static getBalance(userId) {
    const row = db.prepare(`
      SELECT SUM(amount) as balance 
      FROM ledger_entries 
      WHERE userId = ?
    `).get(userId);
    
    // SQLite might return null if no rows or all amounts are null
    return row && row.balance != null ? row.balance : 0;
  }

  static getLedger(userId) {
    return db.prepare(`
      SELECT * FROM ledger_entries 
      WHERE userId = ? 
      ORDER BY createdAt DESC
    `).all(userId);
  }

  static getBalanceBreakdown(userId) {
    const ledger = this.getLedger(userId);
    
    let totalAdvances = 0;
    let totalSettled = 0;
    let totalWithdrawalReversals = 0;
    let totalWithdrawn = 0;
    
    for (const entry of ledger) {
      if (entry.type === 'advance') totalAdvances += entry.amount;
      else if (entry.type === 'final_settlement' || entry.type === 'adjustment') totalSettled += entry.amount;
      else if (entry.type === 'withdrawal_reversal') totalWithdrawalReversals += entry.amount;
      else if (entry.type === 'withdrawal') totalWithdrawn += Math.abs(entry.amount);
    }

    const pendingWithdrawalsRow = db.prepare(`
      SELECT SUM(amount) as amount FROM withdrawals 
      WHERE userId = ? AND status = 'pending'
    `).get(userId);

    const pendingWithdrawals = pendingWithdrawalsRow && pendingWithdrawalsRow.amount != null ? pendingWithdrawalsRow.amount : 0;

    return {
      withdrawableBalance: this.getBalance(userId),
      totalAdvances,
      totalSettled,
      totalWithdrawalReversals,
      totalWithdrawn,
      pendingWithdrawals
    };
  }
}

module.exports = LedgerService;
