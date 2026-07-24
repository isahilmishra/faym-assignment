-- Note: There is no users table. userId is treated as an opaque external identifier.
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    brand TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
    earnings REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    reconciledAt DATETIME
);

CREATE TABLE IF NOT EXISTS advances (
    id TEXT PRIMARY KEY,
    saleId TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    transferredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saleId) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    saleId TEXT,
    type TEXT NOT NULL CHECK(type IN ('advance', 'final_settlement', 'adjustment', 'withdrawal', 'withdrawal_reversal')),
    amount REAL NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saleId) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'cancelled', 'rejected', 'failed')),
    requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME
);
