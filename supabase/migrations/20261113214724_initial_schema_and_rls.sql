-- =========================================================================
-- 1. PROFILES (User Profile, Nutrition Targets & Settings)
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default 'Atleta',
  onboarding_completed boolean not null default false,
  height_cm double precision,
  target_weight_kg double precision,
  training_goal text,
  activity_level text,
  target_calories double precision not null default 2000,
  target_protein double precision not null default 150,
  target_carbs double precision not null default 200,
  target_fat double precision not null default 60,
  target_water_ml integer not null default 2500,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- =========================================================================
-- 2. FOODS (User-created Custom & Open Food Facts cached foods)
-- Note: TACO catalog remains local in SQLite for instant offline search.
-- =========================================================================
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  name_normalized text,
  category text not null default '',
  serving_grams double precision not null default 100,
  calories double precision not null,
  protein double precision not null,
  carbs double precision not null,
  fat double precision not null,
  fiber double precision not null default 0,
  barcode text,
  source text not null default 'custom',
  serving_unit_name text default 'g',
  serving_unit_grams double precision default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_foods_user_name on public.foods(user_id, name);
create index if not exists idx_foods_user_normalized on public.foods(user_id, name_normalized);
create index if not exists idx_foods_user_barcode on public.foods(user_id, barcode);

alter table public.foods enable row level security;

create policy "foods_select_own" on public.foods
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "foods_insert_own" on public.foods
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "foods_update_own" on public.foods
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "foods_delete_own" on public.foods
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 3. DIET_LOGS (Daily Meal Entries)
-- =========================================================================
create table if not exists public.diet_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner', 'supper')),
  food_id text,
  food_name text not null,
  serving_grams double precision not null,
  calories double precision not null,
  protein double precision not null,
  carbs double precision not null,
  fat double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_diet_logs_user_date on public.diet_logs(user_id, date);
create index if not exists idx_diet_logs_user_date_meal on public.diet_logs(user_id, date, meal_type);

alter table public.diet_logs enable row level security;

create policy "diet_logs_select_own" on public.diet_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "diet_logs_insert_own" on public.diet_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "diet_logs_update_own" on public.diet_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "diet_logs_delete_own" on public.diet_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 4. WATER_LOGS (Hydration Entries)
-- =========================================================================
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  amount_ml integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_water_logs_user_date on public.water_logs(user_id, date);

alter table public.water_logs enable row level security;

create policy "water_logs_select_own" on public.water_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "water_logs_insert_own" on public.water_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "water_logs_update_own" on public.water_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "water_logs_delete_own" on public.water_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 5. WORKOUT_ROUTINES (Routine Templates)
-- =========================================================================
create table if not exists public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_workout_routines_user_sort on public.workout_routines(user_id, sort_order);

alter table public.workout_routines enable row level security;

create policy "workout_routines_select_own" on public.workout_routines
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "workout_routines_insert_own" on public.workout_routines
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "workout_routines_update_own" on public.workout_routines
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "workout_routines_delete_own" on public.workout_routines
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 6. ROUTINE_EXERCISES (Exercises Assigned to Routines)
-- =========================================================================
create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  name text not null,
  muscle_group text not null default '',
  target_sets integer not null default 3,
  default_rest_seconds integer not null default 90,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_routine_exercises_routine_sort on public.routine_exercises(routine_id, sort_order);
create index if not exists idx_routine_exercises_user on public.routine_exercises(user_id);

alter table public.routine_exercises enable row level security;

create policy "routine_exercises_select_own" on public.routine_exercises
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "routine_exercises_insert_own" on public.routine_exercises
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "routine_exercises_update_own" on public.routine_exercises
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "routine_exercises_delete_own" on public.routine_exercises
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 7. WORKOUT_SESSIONS (Executed Live & Past Workouts)
-- =========================================================================
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  routine_id uuid references public.workout_routines(id) on delete set null,
  routine_name text not null,
  date text not null,
  start_time text,
  end_time text,
  duration_minutes integer not null default 0,
  total_volume_kg double precision not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_workout_sessions_user_date on public.workout_sessions(user_id, date desc);
create index if not exists idx_workout_sessions_routine on public.workout_sessions(routine_id);

alter table public.workout_sessions enable row level security;

create policy "workout_sessions_select_own" on public.workout_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "workout_sessions_insert_own" on public.workout_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "workout_sessions_update_own" on public.workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "workout_sessions_delete_own" on public.workout_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 8. SET_LOGS (Completed Sets with Weight & Reps)
-- =========================================================================
create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id text,
  exercise_name text not null,
  set_number integer not null,
  weight_kg double precision not null,
  reps integer not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_set_logs_session on public.set_logs(session_id);
create index if not exists idx_set_logs_user_exercise on public.set_logs(user_id, exercise_name, completed);

alter table public.set_logs enable row level security;

create policy "set_logs_select_own" on public.set_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "set_logs_insert_own" on public.set_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "set_logs_update_own" on public.set_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "set_logs_delete_own" on public.set_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 9. BODY_LOGS (Weight, Measurements & Photos)
-- =========================================================================
create table if not exists public.body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  weight_kg double precision not null,
  body_fat_pct double precision,
  waist_cm double precision,
  chest_cm double precision,
  arms_cm double precision,
  legs_cm double precision,
  photo_uris jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_body_logs_user_date on public.body_logs(user_id, date desc);

alter table public.body_logs enable row level security;

create policy "body_logs_select_own" on public.body_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "body_logs_insert_own" on public.body_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "body_logs_update_own" on public.body_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "body_logs_delete_own" on public.body_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 10. CUSTOM_EXERCISES (User-Created Exercises with Categories)
-- =========================================================================
create table if not exists public.custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  category text not null,
  default_sets integer not null default 3,
  default_rest_seconds integer not null default 90,
  created_at timestamptz not null default now()
);

create index if not exists idx_custom_exercises_user_category on public.custom_exercises(user_id, category);

alter table public.custom_exercises enable row level security;

create policy "custom_exercises_select_own" on public.custom_exercises
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "custom_exercises_insert_own" on public.custom_exercises
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "custom_exercises_update_own" on public.custom_exercises
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "custom_exercises_delete_own" on public.custom_exercises
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- 11. STORAGE BUCKET (body-photos) & RLS
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('body-photos', 'body-photos', false)
on conflict (id) do nothing;

create policy "body_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "body_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "body_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "body_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'body-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
