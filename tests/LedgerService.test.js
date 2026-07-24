const db = require('../src/db/database');
const { randomUUID: uuidv4 } = require('crypto');
const LedgerService = require('../src/services/LedgerService');

describe('LedgerService', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ledger_entries; DELETE FROM advances; DELETE FROM withdrawals; DELETE FROM sales;');
  });

  test('Correct balance calculation as SUM of ledger entries for a user', () => {
    const userId = 'ledger_user_1';
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'final_settlement', ?)").run(uuidv4(), userId, 100);
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'advance', ?)").run(uuidv4(), userId, 20);

    const balance = LedgerService.getBalance(userId);
    expect(balance).toBe(120);
  });

  test('Correct handling of each entry type', () => {
    const userId = 'ledger_user_2';
    // advance (+10)
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'advance', ?)").run(uuidv4(), userId, 10);
    // final_settlement (+40)
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'final_settlement', ?)").run(uuidv4(), userId, 40);
    // adjustment (-5)
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'adjustment', ?)").run(uuidv4(), userId, -5);
    // withdrawal (-20)
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'withdrawal', ?)").run(uuidv4(), userId, -20);
    // withdrawal_reversal (+20)
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'withdrawal_reversal', ?)").run(uuidv4(), userId, 20);

    const balance = LedgerService.getBalance(userId);
    // 10 + 40 - 5 - 20 + 20 = 45
    expect(balance).toBe(45);
  });

  test('A user with zero ledger entries returns balance of 0, not an error', () => {
    const userId = 'ledger_user_3';
    const balance = LedgerService.getBalance(userId);
    expect(balance).toBe(0);
  });

  test('A user with only negative adjustments correctly shows a negative or zero balance', () => {
    const userId = 'ledger_user_4';
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'adjustment', ?)").run(uuidv4(), userId, -10);

    const balance = LedgerService.getBalance(userId);
    expect(balance).toBe(-10);
  });

  test('Balance calculation excludes/includes pending withdrawals correctly', () => {
    const userId = 'ledger_user_5';
    // Provide some funds
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'final_settlement', ?)").run(uuidv4(), userId, 100);
    
    // A pending withdrawal has already debited the ledger in WithdrawalService
    db.prepare("INSERT INTO withdrawals (id, userId, amount, status) VALUES (?, ?, ?, 'pending')").run(uuidv4(), userId, 30);
    db.prepare("INSERT INTO ledger_entries (id, userId, type, amount) VALUES (?, ?, 'withdrawal', ?)").run(uuidv4(), userId, -30);

    const balance = LedgerService.getBalance(userId);
    expect(balance).toBe(70);

    const breakdown = LedgerService.getBalanceBreakdown(userId);
    expect(breakdown.withdrawableBalance).toBe(70);
    expect(breakdown.pendingWithdrawals).toBe(30);
    expect(breakdown.totalWithdrawn).toBe(30);
  });
});
