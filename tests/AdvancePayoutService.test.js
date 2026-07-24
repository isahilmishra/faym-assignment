const db = require('../src/db/database');
const { randomUUID: uuidv4 } = require('crypto');
const AdvancePayoutService = require('../src/services/AdvancePayoutService');
const LedgerService = require('../src/services/LedgerService');

describe('AdvancePayoutService', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ledger_entries; DELETE FROM advances; DELETE FROM withdrawals; DELETE FROM sales;');
  });

  test('Creates advance payout for eligible pending sales', () => {
    const saleId = uuidv4();
    const userId = 'user_1';
    db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)')
      .run(saleId, userId, 'brand_1', 'pending', 100);

    const result = AdvancePayoutService.runAdvancePayoutJob();
    expect(result.processed).toBe(1);

    const balance = LedgerService.getBalance(userId);
    expect(balance).toBe(10); // 10% of 100
  });

  test('Does not duplicate advances on subsequent runs', () => {
    const saleId = uuidv4();
    const userId = 'user_1';
    db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)')
      .run(saleId, userId, 'brand_1', 'pending', 100);

    AdvancePayoutService.runAdvancePayoutJob();
    const result2 = AdvancePayoutService.runAdvancePayoutJob();
    
    expect(result2.processed).toBe(0);
    const advancesCount = db.prepare('SELECT COUNT(*) as count FROM advances').get().count;
    expect(advancesCount).toBe(1);
    
    const balance = LedgerService.getBalance(userId);
    expect(balance).toBe(10);
  });
  
  test('Concurrent advance job runs prevent race condition duplicate', async () => {
    const saleId = uuidv4();
    const userId = 'user_1';
    db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)')
      .run(saleId, userId, 'brand_1', 'pending', 100);

    // Simulate concurrent runs
    const promises = [
      new Promise(resolve => resolve(AdvancePayoutService.runAdvancePayoutJob())),
      new Promise(resolve => resolve(AdvancePayoutService.runAdvancePayoutJob())),
      new Promise(resolve => resolve(AdvancePayoutService.runAdvancePayoutJob()))
    ];
    
    await Promise.all(promises);
    
    const advancesCount = db.prepare('SELECT COUNT(*) as count FROM advances').get().count;
    expect(advancesCount).toBe(1);
  });
});
