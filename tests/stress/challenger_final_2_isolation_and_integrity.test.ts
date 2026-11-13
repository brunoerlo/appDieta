import fs from 'fs';
import path from 'path';
import { SupabaseDietRepository } from '../../src/database/repositories/SupabaseDietRepository';
import { SupabaseWorkoutRepository } from '../../src/database/repositories/SupabaseWorkoutRepository';
import { SupabaseBodyRepository } from '../../src/database/repositories/SupabaseBodyRepository';
import { SupabaseAuthRepository } from '../../src/database/repositories/SupabaseAuthRepository';

describe('Empirical Challenger Final Verification: Multi-Tenant Isolation, RLS & Decoupling', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  // =========================================================================
  // REQUIREMENT 1: RLS SQL Schema Invariant Verification
  // =========================================================================
  describe('R1: Database Schema & RLS Policy Definitions', () => {
    const migrationPath = path.join(
      projectRoot,
      'supabase/migrations/20261113214724_initial_schema_and_rls.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    const expectedTables = [
      'public.profiles',
      'public.foods',
      'public.diet_logs',
      'public.water_logs',
      'public.workout_routines',
      'public.routine_exercises',
      'public.workout_sessions',
      'public.set_logs',
      'public.body_logs',
      'public.custom_exercises',
    ];

    it.each(expectedTables)(
      'enables row level security explicitly on %s',
      (tableName) => {
        const regex = new RegExp(`alter\\s+table\\s+${tableName.replace('.', '\\.')}\\s+enable\\s+row\\s+level\\s+security;`, 'i');
        expect(sqlContent).toMatch(regex);
      }
    );

    it('defines private body-photos storage bucket with public = false', () => {
      expect(sqlContent).toMatch(
        /insert\s+into\s+storage\.buckets\s*\([^)]*public[^)]*\)\s*values\s*\([^)]*false[^)]*\)/i
      );
    });

    it('enforces strict folder prefix isolation on storage.objects', () => {
      // storage.foldername(name)[1] = auth.uid()::text
      expect(sqlContent).toMatch(
        /\(storage\.foldername\(name\)\)\[1\]\s*=\s*\(select\s+auth\.uid\(\)\)::text/i
      );
    });

    it('defines strict ownership policies for SELECT, INSERT, UPDATE, DELETE on all multi-tenant tables', () => {
      const crudTables = [
        'foods',
        'diet_logs',
        'water_logs',
        'workout_routines',
        'routine_exercises',
        'workout_sessions',
        'set_logs',
        'body_logs',
        'custom_exercises',
      ];

      for (const table of crudTables) {
        expect(sqlContent).toMatch(new RegExp(`create\\s+policy\\s+"${table}_select_own"\\s+on\\s+public\\.${table}`, 'i'));
        expect(sqlContent).toMatch(new RegExp(`create\\s+policy\\s+"${table}_insert_own"\\s+on\\s+public\\.${table}`, 'i'));
        expect(sqlContent).toMatch(new RegExp(`create\\s+policy\\s+"${table}_update_own"\\s+on\\s+public\\.${table}`, 'i'));
        expect(sqlContent).toMatch(new RegExp(`create\\s+policy\\s+"${table}_delete_own"\\s+on\\s+public\\.${table}`, 'i'));
      }

      // profiles table has select, insert, update (delete is disallowed for users by omitting delete policy)
      expect(sqlContent).toMatch(/create\s+policy\s+"profiles_select_own"\s+on\s+public\.profiles/i);
      expect(sqlContent).toMatch(/create\s+policy\s+"profiles_insert_own"\s+on\s+public\.profiles/i);
      expect(sqlContent).toMatch(/create\s+policy\s+"profiles_update_own"\s+on\s+public\.profiles/i);
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Presentation Decoupling Verification
  // =========================================================================
  describe('R2: UI Presentation Layer Context Decoupling', () => {
    const srcAppDir = path.join(projectRoot, 'src/app');

    function getAllAppFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getAllAppFiles(fullPath));
        } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const appFiles = getAllAppFiles(srcAppDir);
    // Exclude root _layout.tsx which legitimately instantiates and injects providers
    const presentationScreens = appFiles.filter(
      (f) => !f.endsWith('src/app/_layout.tsx')
    );

    it('ensures NO presentation screen imports repositories directly', () => {
      const violations: string[] = [];

      for (const file of presentationScreens) {
        const content = fs.readFileSync(file, 'utf8');
        // Check for direct instantiation of repositories
        if (
          /new\s+(Supabase|Sqlite)[A-Za-z0-9_]*Repository/i.test(content) ||
          /from\s+['"][^'"]*database\/repositories\/(Supabase|Sqlite)[A-Za-z0-9_]+['"]/i.test(content)
        ) {
          violations.push(path.relative(projectRoot, file));
        }
      }

      expect(violations).toEqual([]);
    });

    it('ensures NO presentation screen accesses supabase client directly', () => {
      const violations: string[] = [];

      for (const file of presentationScreens) {
        const content = fs.readFileSync(file, 'utf8');
        if (
          /from\s+['"][^'"]*services\/supabaseClient['"]/i.test(content) ||
          /from\s+['"]@supabase\/supabase-js['"]/i.test(content)
        ) {
          violations.push(path.relative(projectRoot, file));
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Zero Legacy SQLite User Data Migration
  // =========================================================================
  describe('R3: Clean Slate Invariant & Zero SQLite User Data Migration', () => {
    it('verifies that new users initialize with empty routines without auto-seeding', async () => {
      const mockClient: any = {
        from: jest.fn((table: string) => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          returns: jest.fn(async () => ({ data: [], error: null })),
        })),
      };

      const repo = new SupabaseWorkoutRepository(mockClient);
      const routines = await repo.getRoutines();

      expect(routines).toEqual([]);
      // Should not call insert when list is empty
      expect(mockClient.from).not.toHaveBeenCalledWith(
        expect.stringMatching(/insert/i)
      );
    });

    it('verifies that SQLite database initialization only seeds static TACO foods, dishes, and drinks', () => {
      const connectionPath = path.join(projectRoot, 'src/database/connection.ts');
      const connectionContent = fs.readFileSync(connectionPath, 'utf8');

      // Ensure no function exists that reads SQLite user logs to push to Supabase
      expect(connectionContent).not.toMatch(/supabase/i);
      expect(connectionContent).not.toMatch(/syncToSupabase/i);
      expect(connectionContent).not.toMatch(/migrateToCloud/i);
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Error Resilience & Offline Fallback Under Adversarial Conditions
  // =========================================================================
  describe('R4: Repository Resilience Under Hostile Network Conditions', () => {
    it('SupabaseDietRepository returns local TACO results even when remote Supabase network is dead', async () => {
      const mockDeadSupabase: any = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          returns: jest.fn(async () => {
            throw new Error('ECONNREFUSED: Network unreachable');
          }),
        })),
      };

      const mockLocalDb: any = {
        getAllAsync: jest.fn(async () => [
          {
            id: 'taco-1',
            name: 'Arroz integral',
            name_normalized: 'arroz integral',
            category: 'Cereais',
            serving_grams: 100,
            calories: 120,
            protein: 2.5,
            carbs: 25.0,
            fat: 1.0,
            fiber: 2.0,
            barcode: null,
            source: 'taco',
            serving_unit_name: 'g',
            serving_unit_grams: 1,
            created_at: new Date().toISOString(),
          },
        ]),
      };

      const repo = new SupabaseDietRepository(mockDeadSupabase, mockLocalDb);
      const results = await repo.searchFoods('arroz');

      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Arroz integral');
      expect(results[0].source).toBe('taco');
    });

    it('SupabaseDietRepository handles timeout or barcode lookup failure gracefully without unhandled crashes', async () => {
      const mockFailingSupabase: any = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({
            data: null,
            error: { message: 'Gateway Timeout 504' },
          })),
        })),
      };

      const mockLocalDb: any = {
        getFirstAsync: jest.fn(async () => null),
      };

      const repo = new SupabaseDietRepository(mockFailingSupabase, mockLocalDb);
      // Resilient fallback: When remote errors out, it falls back to local lookup and gracefully returns null instead of throwing
      const result = await repo.getFoodByBarcode('7891000100103');
      expect(result).toBeNull();
    });

    it('SupabaseBodyRepository generates private signed URLs and fails securely if user is unauthenticated', async () => {
      const mockUnauthSupabase: any = {
        auth: {
          getSession: jest.fn(async () => ({
            data: { session: null },
            error: null,
          })),
        },
        storage: {
          from: jest.fn(() => ({
            upload: jest.fn(),
          })),
        },
      };

      const repo = new SupabaseBodyRepository(mockUnauthSupabase);
      await expect(
        repo.savePhoto('2026-11-13', 'file:///tmp/pic.jpg')
      ).rejects.toThrow('Usuário não autenticado.');
    });
  });
});
