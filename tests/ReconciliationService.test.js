const db = require('../src/db/database');
const { randomUUID: uuidv4 } = require('crypto');
const ReconciliationService = require('../src/services/ReconciliationService');
const AdvancePayoutService = require('../src/services/AdvancePayoutService');
const LedgerService = require('../src/services/LedgerService');

describe('ReconciliationService', () => {
  beforeEach(() => {
    db.exec('DELETE FROM ledger_entries; DELETE FROM advances; DELETE FROM withdrawals; DELETE FROM sales;');
  });

  test('Reconciling approved sale with prior advance', () => {
    const saleId = uuidv4();
    const userId = 'user_2';
    db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)')
      .run(saleId, userId, 'brand_1', 'pending', 50);

    AdvancePayoutService.runAdvancePayoutJob();
    const result = ReconciliationService.reconcileSale(saleId, 'approved');
    
    expect(result.advancePaid).toBe(5);
    expect(result.finalAdjustmentAmount).toBe(45); // 50 - 5
    expect(LedgerService.getBalance(userId)).toBe(50); // 5 + 45
  });

  test('Reconciling rejected sale with prior advance', () => {
    const saleId = uuidv4();
    const userId = 'user_3';
    db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)')
      .run(saleId, userId, 'brand_1', 'pending', 50);

    AdvancePayoutService.runAdvancePayoutJob();
    const result = ReconciliationService.reconcileSale(saleId, 'rejected');
    
    expect(result.advancePaid).toBe(5);
    expect(result.finalAdjustmentAmount).toBe(-5);
    expect(LedgerService.getBalance(userId)).toBe(0);
  });

  test('Reconciling sale with no prior advance', () => {
    const saleId = uuidv4();
    const userId = 'user_4';
    db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)')
      .run(saleId, userId, 'brand_1', 'pending', 50);

    const result = ReconciliationService.reconcileSale(saleId, 'approved');
    
    expect(result.advancePaid).toBe(0);
    expect(result.finalAdjustmentAmount).toBe(50);
    expect(LedgerService.getBalance(userId)).toBe(50);
  });

  test('Reconciling already reconciled sale throws error', () => {
    const saleId = uuidv4();
    const userId = 'user_5';
    db.prepare('INSERT INTO sales (id, userId, brand, status, earnings) VALUES (?, ?, ?, ?, ?)')
      .run(saleId, userId, 'brand_1', 'pending', 50);

    ReconciliationService.reconcileSale(saleId, 'approved');
    
    expect(() => {
      ReconciliationService.reconcileSale(saleId, 'approved');
    }).toThrow('Sale has already been reconciled');
  });
});
