# Milestone M1 Adversarial Review Report: Relational Integrity, Atomicity & WAL Concurrency

**Agent:** `challenger_m1_2` (Relational Integrity Challenger)  
**Date:** 2026-11-06T14:39:00Z  
**Milestone:** M1 — Database, Schemas, TACO Seed & Repositories  
**Output Path:** `/home/bruno/Documentos/app/.agents/teamwork/challenger_m1_2/handoff.md`  
**Verdict:** **APPROVE**

---

## 1. Observation

1. **Schema DDL & Foreign Key Definitions (`src/database/schema.ts`):**
   - Line 100: `routine_exercises` specifies `FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE`.
   - Line 120: `workout_sessions` specifies `FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE SET NULL`.
   - Line 139: `set_logs` specifies `FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE`.
   - Line 46-58: `diet_logs` stores `food_id TEXT` and denormalized `food_name`, `calories`, `protein`, `carbs`, `fat`, `serving_grams` without an `ON DELETE CASCADE` constraint.
   - Line 14: `configurePragmas` in `src/database/connection.ts` sets `PRAGMA journal_mode = WAL;` and `PRAGMA foreign_keys = ON;`.

2. **Transaction Handling in Repositories (`src/database/repositories/SqliteWorkoutRepository.ts`):**
   - Lines 156-202: `createRoutine` executes routine insertion and exercise insertions inside `this.db.withTransactionAsync`.
   - Lines 212-248: `updateRoutine` runs routine update, exercise deletion, and exercise re-insertion within `this.db.withTransactionAsync`.
   - Lines 296-360: `saveWorkoutSession` inserts session header and all set logs inside `this.db.withTransactionAsync`.

3. **Database Migration Atomicity (`src/database/connection.ts`):**
   - Lines 117-122: `runMigrations` wraps execution of `runMigrationV1(db)` and `PRAGMA user_version = 1;` inside `db.withTransactionAsync`.
   - `tests/helpers/inMemoryDb.ts` lines 44-53 implement `withTransactionAsync` with `BEGIN TRANSACTION;` and `COMMIT;`, catching any error and issuing `ROLLBACK;`.

4. **Empirical Adversarial Test Suite Execution:**
   - Authored test file `/home/bruno/Documentos/app/tests/unit/RelationalIntegrityAndConcurrency.test.ts` (12 test cases covering all 4 assigned challenge areas).
   - Execution command:
     ```bash
     export PATH="/home/bruno/.nvm/versions/node/v26.13.0/bin:$PATH" && npx jest tests/unit/RelationalIntegrityAndConcurrency.test.ts --verbose
     ```
   - Verbatim output:
     ```text
     PASS tests/unit/RelationalIntegrityAndConcurrency.test.ts
       Relational Integrity, Atomic Transactions & WAL Concurrency Tests
         1. Foreign Key Cascades & Constraints
           ✓ cascades deletion of workout_routine to routine_exercises (ON DELETE CASCADE) (29 ms)
           ✓ cascades deletion of workout_sessions to set_logs (ON DELETE CASCADE) (9 ms)
           ✓ sets workout_sessions.routine_id to NULL when routine is deleted (ON DELETE SET NULL) (8 ms)
           ✓ rejects insertion of child rows with non-existent foreign keys (9 ms)
         2. Food Deletion & Historical Diet Logs Preservation
           ✓ preserves existing diet_logs and nutrition summaries when a food item is deleted from foods table (13 ms)
         3. Atomic Rollback on Failed Transactions
           ✓ rolls back all records in a bulk insert transaction when a mid-batch error occurs (10 ms)
           ✓ rolls back parent workout_session when set insertion fails midway in saveWorkoutSession (9 ms)
           ✓ rolls back parent workout_routine when exercise insertion fails in createRoutine (9 ms)
           ✓ rolls back schema and version on failed migration transaction (7 ms)
         4. Concurrency & Race Conditions
           ✓ handles high-concurrency parallel writes on a single connection without race conditions (12 ms)
           ✓ handles simultaneous concurrent reads and writes without deadlocks or corruption (14 ms)
           ✓ verifies WAL mode concurrency with multiple connections on disk (non-blocking readers during writes) (36 ms)

     Test Suites: 1 passed, 1 total
     Tests:       12 passed, 12 total
     Snapshots:   0 total
     Time:        2.132 s, estimated 5 s
     Ran all test suites matching tests/unit/RelationalIntegrityAndConcurrency.test.ts.
     ```

5. **Peer Challenger Discrepancy Observation:**
   - In `tests/stress/m1_stress.test.ts`, 3 failures occurred due to test authoring flaws:
     - Lines 461-462 attempted accessing `estimatedOneRepMax` and `maxWeight`, whereas the domain interface `ExerciseHistoryPoint` (`src/types/domain.ts:118`) defines `estimated1RM` and `maxWeightKg`.
     - Line 184 asserted `'açaí'` in TACO seed, which was not part of the 42 curated staples.
     - Line 105 asserted `avgLatency < 50ms` (measured 56.25ms), whereas the acceptance criteria in `ORIGINAL_REQUEST.md` line 35 is `< 100ms` (max latency was 96ms).

---

## 2. Logic Chain

1. **Foreign Key Cascade Verification:**
   - *Observation (Observation 1, 4)*: Deleting a routine from `workout_routines` triggered SQLite's native foreign key engine (`PRAGMA foreign_keys = ON;`). Raw query verification showed `SELECT COUNT(*) FROM routine_exercises WHERE routine_id = ?` dropped from 3 to 0. Similarly, deleting a session in `workout_sessions` reduced child `set_logs` from 4 to 0.
   - *Reasoning*: Cascade rules are enforced at the SQLite engine level. No custom cleanup loops are needed, preventing orphan exercise or set records.
   - *Deduction*: Referential integrity is resilient and complies with relational standards.

2. **Historical Log Preservation on Food Deletion:**
   - *Observation (Observation 1, 4)*: When a food item was created and logged into `diet_logs`, subsequent execution of `DELETE FROM foods WHERE id = ?` succeeded (`changes: 1`). Querying `getDailyLogs(date)` returned the complete meal log with `foodName`, `servingGrams`, `calories`, `protein`, `carbs`, and `fat` preserved. `getDailyNutritionSummary(date)` accurately computed total macros and calories.
   - *Reasoning*: Because `diet_logs` captures a snapshot of the nutritional values and food name at logging time, catalog changes (e.g., deleting or modifying a custom food) do not erase past user nutrition history or break previous days' calculations.
   - *Deduction*: Preserving `diet_logs` on food deletion is the correct architecture for an offline-first fitness app and passed empirical verification.

3. **Transaction Atomicity & Rollback:**
   - *Observation (Observation 2, 3, 4)*:
     - In a bulk insert of 20 items where item 11 threw a `CHECK` constraint violation, `withTransactionAsync` caught the error and issued `ROLLBACK`. Querying the table confirmed 0 items were inserted.
     - In `saveWorkoutSession`, injecting a null weight in set 2 triggered a `NOT NULL` constraint error. Post-failure queries verified that neither the parent `workout_sessions` record nor set 1 were committed.
     - In a migration failure simulation, `CREATE TABLE` and data insertions were rolled back completely, and `PRAGMA user_version` remained at 1.
   - *Reasoning*: SQLite supports fully transactional DDL and DML. Wrapping multi-row operations inside `withTransactionAsync` guarantees that errors leave no partially inserted records.
   - *Deduction*: Database mutations are strictly ACID compliant.

4. **WAL Mode Concurrency & Multi-Connection Isolation:**
   - *Observation (Observation 1, 4)*:
     - 50 concurrent `addWaterLog` promises executed in parallel via `Promise.all` resulted in exactly 12,500 ml logged with 50 distinct rows.
     - 40 mixed operations (20 writes + 20 reads) resolved concurrently without deadlocks.
     - On a real disk-based database file with two independent connections, Connection 1 began an uncommitted `BEGIN IMMEDIATE` write transaction. While active, Connection 2 performed reads without blocking, seeing an isolated snapshot. Upon Connection 1's `COMMIT`, Connection 2 immediately saw the committed data. Interleaved concurrent writes with `busy_timeout` executed without `SQLITE_BUSY` errors.
   - *Reasoning*: `PRAGMA journal_mode = WAL` enables concurrent readers and writers without blocking or table corruption.
   - *Deduction*: The database architecture reliably supports background queries, live UI reads, and batch writes.

---

## 3. Caveats

1. **SQLite Native Concurrency Limit**:
   - While WAL mode allows non-blocking simultaneous reads during a write, SQLite supports only one active writer transaction across all connections at any given instant. Under extreme write contention, additional connections will wait up to `busy_timeout` (configured to 5000ms). This is a well-known SQLite property and appropriate for a single-user mobile app.
2. **Foreign Key Performance on Bulk Deletes**:
   - SQLite checks foreign key constraints on every delete. Indexes `idx_routine_exercises_routine` and `idx_set_logs_session` exist in `schema.ts`, ensuring cascading deletes run in `O(log N)` index lookups rather than table scans.
3. **No other caveats**:
   - All 4 challenge dimensions were empirically verified with real SQLite databases.

---

## 4. Conclusion & Verdict

**Explicit Verdict:** **APPROVE**

Milestone M1 passes all empirical adversarial relational integrity, transaction atomicity, and concurrency checks:
1. Foreign key cascades (`ON DELETE CASCADE`, `ON DELETE SET NULL`) execute accurately with 0 orphan records.
2. Food catalog item deletion leaves existing `diet_logs` historical entries and daily nutrition summaries completely intact.
3. Transactional rollback operates across bulk inserts, multi-table repository operations, and schema migrations without partial state leaks.
4. High-concurrency async operations and multi-connection WAL mode disk isolation execute reliably without race conditions, corruption, or deadlock.

---

## 5. Verification Method

To independently verify all findings:

1. **Execute Relational Integrity & Concurrency Test Suite:**
   ```bash
   export PATH="/home/bruno/.nvm/versions/node/v26.13.0/bin:$PATH"
   npx jest tests/unit/RelationalIntegrityAndConcurrency.test.ts --verbose
   ```
   *Expected Output:* 12 tests passed, 0 failures.

2. **Inspect Test Code:**
   - View `/home/bruno/Documentos/app/tests/unit/RelationalIntegrityAndConcurrency.test.ts`.
