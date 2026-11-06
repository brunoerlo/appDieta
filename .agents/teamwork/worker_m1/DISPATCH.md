## 2026-11-06T14:11:41Z
You are worker_m1, working as M1 Database & Repository Implementer.
Your working directory is: /home/bruno/Documentos/app/.agents/teamwork/worker_m1/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You MUST read:
- /home/bruno/Documentos/app/.agents/teamwork/ORIGINAL_REQUEST.md
- /home/bruno/Documentos/app/PROJECT.md
- /home/bruno/Documentos/app/AGENTS.md
- /home/bruno/Documentos/app/.agents/teamwork/explorer_m1_1/handoff.md
- /home/bruno/Documentos/app/.agents/teamwork/explorer_m1_2/handoff.md
- /home/bruno/Documentos/app/.agents/teamwork/explorer_m1_3/handoff.md

Scope of Work for Milestone M1:
1. Install dependencies per AGENTS.md rules (`npx --yes expo install` for expo packages, npm for others):
   - Core & DB: `expo-sqlite`, `expo-constants`, `expo-file-system`
   - Testing: `jest-expo`, `jest`, `@types/jest`, `better-sqlite3`, `@types/better-sqlite3`
   - UI/Routing base: `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-status-bar`
2. Update configurations:
   - `package.json`: update `"main": "expo-router/entry"`, add `"test": "jest --runInBand"`.
   - `app.json`: add `"scheme": "fitnessapp"`, `"userInterfaceStyle": "dark"`, plugins (`expo-router`, `expo-sqlite`), `"experiments": { "typedRoutes": true }`.
   - `tsconfig.json`: add path alias `@/*` pointing to `./src/*`, add types `["jest"]`.
   - `jest.config.js`: preset `jest-expo`, moduleNameMapper for `@/*`.
3. Implement SQLite and Repository Layer:
   - `src/types/domain.ts`: All domain types (UserProfile, FoodItem, DietLogEntry, WaterLogEntry, WorkoutRoutine, RoutineExercise, WorkoutSession, SetLog, BodyLog).
   - `src/database/schema.ts`: DDL for all 9 tables (`users`, `foods`, `diet_logs`, `water_logs`, `workout_routines`, `routine_exercises`, `workout_sessions`, `set_logs`, `body_logs`) and 10 indexes.
   - `src/database/connection.ts`: Database connection manager with WAL mode, foreign keys, and migration runner (`PRAGMA user_version`).
   - `src/database/seed/tacoFoods.ts`: Complete 42-item Brazilian TACO food dataset with macros per 100g.
   - `src/database/seed/defaultRoutines.ts`: Default routines (ABC and Push/Pull/Legs).
   - `src/database/repositories/interfaces.ts`: `IDietRepository`, `IWorkoutRepository`, `IBodyRepository`, `IAuthRepository`, and `ISqliteDatabase`.
   - `src/database/repositories/SqliteDietRepository.ts`
   - `src/database/repositories/SqliteWorkoutRepository.ts`
   - `src/database/repositories/SqliteBodyRepository.ts`
   - `src/database/repositories/SqliteAuthRepository.ts`
4. Implement Test Harness and Unit Tests:
   - `tests/helpers/inMemoryDb.ts`: Test database adapter executing real migrations & seed in memory.
   - `tests/setup.ts`: Jest setup file.
   - `tests/unit/DietRepository.test.ts`: Full CRUD test suite for DietRepository (food search <100ms, meal logs, water logs).
   - `tests/unit/WorkoutRepository.test.ts`: Full CRUD test suite for WorkoutRepository (routines, exercises, live session, previous load lookup).
   - `tests/unit/BodyRepository.test.ts`: Full CRUD test suite for BodyRepository (weight logs, 7-day moving average, body fat/composition, circumferences).
   - `tests/unit/AuthRepository.test.ts`: Full CRUD test suite for AuthRepository (profile, goals, theme).
5. Verification:
   - Execute `npm test` and verify 100% of tests pass.
   - Execute `npx tsc --noEmit` and verify zero TypeScript errors.

Write a detailed handoff report in your working directory:
`/home/bruno/Documentos/app/.agents/teamwork/worker_m1/handoff.md`
Include the exact test execution output and build verification in your report.
When done, notify orchestrator (388f3ea2-a57e-484c-9a71-c71104ca53a9) via send_message.
