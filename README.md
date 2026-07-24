<div align="center">
  <h1>💸 User Payout Management System</h1>
  <p><strong>A robust, transaction-safe Node.js backend for managing affiliate sales payouts.</strong></p>
</div>

<br />

## 🚀 Overview

This system manages advances, reconciliation, withdrawals, and balances using a strict **append-only ledger** for maximum financial integrity. Built for reliability, it seamlessly handles concurrent race conditions, guarantees idempotent payouts, and ensures flawless auditability.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js + Express
- **Database:** SQLite (powered by the synchronous `better-sqlite3` driver)
- **Testing:** Jest (with full unit test coverage)
- **Language:** JavaScript

---

## ⚙️ Setup & Running

Get the system up and running in seconds:

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the local server:**
   ```bash
   node src/index.js
   ```
3. **Run the Seed Script** *(Executes the exact scenario from the assignment PDF)*:
   ```bash
   node src/db/seed.js
   ```
4. **Run the Test Suite:**
   ```bash
   npx jest
   ```

> 💡 **Tip:** A `postman_collection.json` is included in the root directory. Import it into Postman to instantly test all endpoints!

---

## 🧪 Testing Layers

This project employs a robust, two-tier testing strategy to ensure both code correctness and API reliability:

- **Unit Tests (Jest)** — Run via `npm run test:unit`
  These test the core business logic (Services) in strict isolation. By mocking the database or using in-memory databases, they quickly verify that algorithms (like ledger calculations, advance rules, and withdrawal cooldowns) are flawless before any HTTP layer is introduced.

- **End-to-End Tests (Bash script)** — Requires server running, then run `npm run test:e2e`
  This executes `test.sh`, which uses `curl` to hit the actual live API endpoints. It validates that the Express routers, middleware, database layer, and business logic all work together seamlessly as a real client would experience them.

**Why both?** Jest verifies the internal engine's mathematics and error-handling rapidly and repeatedly. The E2E script guarantees the entire request/response cycle over the network functions as intended in a production-like environment.

---

## 🧠 Design Decisions & Trade-offs

Here’s a look under the hood at why certain architectural choices were made:

### 1. Ledger-based balance vs. Mutable balance column
A mutable balance column (e.g., `UPDATE users SET balance = balance + X`) is highly susceptible to race conditions and audit loss, particularly under heavy load. By using an append-only `ledger_entries` table, the user's balance is calculated dynamically (`SUM(amount)`). This provides a perfect audit trail of every financial event and guarantees ledger accuracy.

### 2. Unique constraints vs. App-level checks
In the Advance Payout Job, if two workers run concurrently, they might both read that a sale has no advance and both try to issue one. App-level checks (like a `SELECT` before `INSERT`) still leave a race condition window open. Enforcing a `UNIQUE` constraint on `saleId` inside the `advances` table allows the database engine to reject the second insertion atomically, eliminating any chance of double-payments.

### 3. Why SQLite?
SQLite is embedded, meaning there's no separate database server to configure and manage. Crucially, it provides full **ACID transaction support**, which is absolutely mandatory for money-handling applications. Using `better-sqlite3` allows a completely synchronous API, vastly simplifying the application logic and making transaction execution straightforward and bug-free.

### 4. Atomic 24-hour Withdrawal Rule
Instead of fetching the last withdrawal timestamp in the app layer (which leaves a window for double-withdrawals), we use an atomic `INSERT ... SELECT` pattern with a `WHERE NOT EXISTS` clause:
```sql
INSERT INTO withdrawals (...) SELECT ... WHERE NOT EXISTS (...)
```
If multiple concurrent withdrawal requests arrive within milliseconds, the database safely serializes the statements. The second insert results in `0` rows affected, which the app gracefully detects and rejects.

### 5. Direct Unit Testing of Ledger Calculation
The `LedgerService` calculates the user's single source of truth balance by aggregating across all transactional events dynamically. By providing direct unit tests (`tests/LedgerService.test.js`) validating the ledger parsing logic across zero-states, pending withdrawals, and various adjustment types, we guarantee financial accuracy before a single endpoint is even hit.

---

## 🗄️ Database Schema

> **Note:** There is no local `users` table. `userId` is treated as an opaque external identifier passed in from the calling system.

```text
  [ users ] (implied)
      1
      |
      *
  [ sales ] 1 -------- 0..1 [ advances ]
  - id (PK)                 - id (PK)
  - userId                  - saleId (FK, UNIQUE)
  - brand                   - amount
  - status                  - transferredAt
  - earnings
  - createdAt
  - reconciledAt
      1
      |
      *
  [ ledger_entries ] * -- 1 [ users ] (implied)
  - id (PK)
  - userId
  - saleId (FK nullable)
  - type (advance/final_settlement/adjustment/withdrawal/withdrawal_reversal)
  - amount
  - createdAt

  [ withdrawals ] * ----- 1 [ users ] (implied)
  - id (PK)
  - userId
  - amount
  - status (pending/completed/cancelled/rejected/failed)
  - requestedAt
  - completedAt
```

---

## 🏗️ File Architecture

The project follows a layered architecture pattern separating database connectivity, core business logic, and HTTP routing:

```text
/
├── src/
│   ├── app.js               # Express application initialization & middleware
│   ├── index.js             # Entry point (server listener)
│   ├── config/
│   │   └── constants.js     # Global constants & magic numbers
│   ├── db/
│   │   ├── database.js      # SQLite connection & PRAGMA configurations
│   │   ├── schema.sql       # SQL DDL for table & schema definitions
│   │   └── seed.js          # Simulator script for the PDF assignment scenario
│   ├── routes/              # Thin Express API route handlers mapping HTTP to services
│   │   ├── balance.js       # Read-only endpoints for user balance/ledger data
│   │   ├── payouts.js
│   │   ├── sales.js
│   │   └── withdrawals.js
│   └── services/            # Pure business logic (transaction-safe, decoupled from HTTP)
│       ├── AdvancePayoutService.js
│       ├── LedgerService.js
│       ├── ReconciliationService.js
│       └── WithdrawalService.js
├── tests/                   # Comprehensive Jest test suites verifying business logic
│   ├── AdvancePayoutService.test.js
│   ├── LedgerService.test.js
│   ├── ReconciliationService.test.js
│   └── WithdrawalService.test.js
├── package.json             # Project dependencies (Express, Jest, SQLite, etc.)
├── postman_collection.json  # Exported API Collection for manual testing
└── README.md                # You are here!
```
