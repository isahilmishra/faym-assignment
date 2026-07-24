const db = require('../src/db/database');
const { randomUUID: uuidv4 } = require('crypto');
const WithdrawalService = require('../src/services/WithdrawalService');
const LedgerService = require('../src/services/LedgerService');

describe('WithdrawalService', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ledger_entries; DELETE FROM advances; DELETE FROM withdrawals; DELETE FROM sales;');
  });

  test('Allows withdrawal if balance is sufficient', () => {
    const userId = 'user_6';
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'final_settlement', ?)")
      .run(uuidv4(), userId, 100);

    const withdrawal = WithdrawalService.requestWithdrawal(userId, 40);
    expect(withdrawal.amount).toBe(40);
    
    expect(LedgerService.getBalance(userId)).toBe(60);
  });

  test('Rejects withdrawal if balance is insufficient', () => {
    const userId = 'user_7';
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'final_settlement', ?)")
      .run(uuidv4(), userId, 30);

    expect(() => {
      WithdrawalService.requestWithdrawal(userId, 40);
    }).toThrow('Insufficient balance');
  });

  test('Rejects withdrawal if attempted within 24 hours of previous one', () => {
    const userId = 'user_8';
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'final_settlement', ?)")
      .run(uuidv4(), userId, 100);

    WithdrawalService.requestWithdrawal(userId, 10);
    
    expect(() => {
      WithdrawalService.requestWithdrawal(userId, 10);
    }).toThrow('You can only make one withdrawal every 24 hours');
  });

  test('Rejects zero or negative amounts', () => {
    const userId = 'user_9';
    expect(() => WithdrawalService.requestWithdrawal(userId, 0)).toThrow('Withdrawal amount must be greater than zero');
  });

  test('Failed payout reversal restores balance and allows new withdrawal', () => {
    const userId = 'user_10';
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'final_settlement', ?)")
      .run(uuidv4(), userId, 100);

    const withdrawal = WithdrawalService.requestWithdrawal(userId, 40);
    expect(LedgerService.getBalance(userId)).toBe(60);

    // Fail it
    WithdrawalService.failWithdrawal(withdrawal.id, 'failed');
    
    // Balance should be restored
    expect(LedgerService.getBalance(userId)).toBe(100);

    // We can withdraw again because the previous one is 'failed', not 'completed' or 'pending'
    const newWithdrawal = WithdrawalService.requestWithdrawal(userId, 50);
    expect(newWithdrawal.amount).toBe(50);
    expect(LedgerService.getBalance(userId)).toBe(50);
  });
});
