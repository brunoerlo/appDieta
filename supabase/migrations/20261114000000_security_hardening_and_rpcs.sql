-- =========================================================================
-- Migration: 20261114000000_security_hardening_and_rpcs.sql
-- Purpose: Security hardening (C-01 Cross-Tenant FK RLS, M-01 Finite CHECK
--          constraints, storage bucket limits, anon revocation, immutable
--          profile columns trigger, and A-06 atomic workout RPCs).
--
-- ROLLBACK SQL:
--   drop function if exists public.save_workout_session_atomic(uuid, text, text, text, text, integer, double precision, text, jsonb);
--   drop function if exists public.update_workout_routine_atomic(uuid, text, text, boolean, integer, jsonb);
--   drop trigger if exists trg_protect_profile_immutable_columns on public.profiles;
--   drop function if exists public.protect_profile_immutable_columns();
--   alter table public.profiles drop constraint if exists chk_profiles_bounds;
--   alter table public.foods drop constraint if exists chk_foods_bounds;
--   alter table public.diet_logs drop constraint if exists chk_diet_logs_bounds;
--   alter table public.water_logs drop constraint if exists chk_water_logs_bounds;
--   alter table public.workout_routines drop constraint if exists chk_workout_routines_bounds;
--   alter table public.routine_exercises drop constraint if exists chk_routine_exercises_bounds;
--   alter table public.workout_sessions drop constraint if exists chk_workout_sessions_bounds;
--   alter table public.set_logs drop constraint if exists chk_set_logs_bounds;
--   alter table public.body_logs drop constraint if exists chk_body_logs_bounds;
--   alter table public.custom_exercises drop constraint if exists chk_custom_exercises_bounds;
-- =========================================================================

-- =========================================================================
-- 1. [C-01] Cross-Tenant FK Validation in RLS Policies
-- =========================================================================

-- 1.1 public.routine_exercises: verify routine_id belongs to auth.uid()
drop policy if exists "routine_exercises_insert_own" on public.routine_exercises;
create policy "routine_exercises_insert_own" on public.routine_exercises
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.workout_routines r
      where r.id = routine_id
        and r.user_id = (select auth.uid())
    )
  );

drop policy if exists "routine_exercises_update_own" on public.routine_exercises;
create policy "routine_exercises_update_own" on public.routine_exercises
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.workout_routines r
      where r.id = routine_id
        and r.user_id = (select auth.uid())
    )
  );

-- 1.2 public.workout_sessions: verify routine_id (when not null) belongs to auth.uid()
drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
create policy "workout_sessions_insert_own" on public.workout_sessions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      routine_id is null
      or exists (
        select 1
        from public.workout_routines r
        where r.id = routine_id
          and r.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
create policy "workout_sessions_update_own" on public.workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      routine_id is null
      or exists (
        select 1
        from public.workout_routines r
        where r.id = routine_id
          and r.user_id = (select auth.uid())
      )
    )
  );

-- 1.3 public.set_logs: verify session_id belongs to auth.uid()
drop policy if exists "set_logs_insert_own" on public.set_logs;
create policy "set_logs_insert_own" on public.set_logs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.workout_sessions ws
      where ws.id = session_id
        and ws.user_id = (select auth.uid())
    )
  );

drop policy if exists "set_logs_update_own" on public.set_logs;
create policy "set_logs_update_own" on public.set_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.workout_sessions ws
      where ws.id = session_id
        and ws.user_id = (select auth.uid())
    )
  );

-- =========================================================================
-- 2. [M-01] Finite CHECK Constraints Across All Public Tables
-- =========================================================================

alter table public.profiles drop constraint if exists chk_profiles_bounds;
alter table public.profiles add constraint chk_profiles_bounds check (
  char_length(name) between 1 and 120
  and target_calories >= 0 and target_calories <= 20000
  and target_protein >= 0 and target_protein <= 2000
  and target_carbs >= 0 and target_carbs <= 3000
  and target_fat >= 0 and target_fat <= 1000
  and target_water_ml >= 0 and target_water_ml <= 20000
  and (height_cm is null or (height_cm >= 50 and height_cm <= 300))
  and (target_weight_kg is null or (target_weight_kg >= 20 and target_weight_kg <= 500))
);

alter table public.foods drop constraint if exists chk_foods_bounds;
alter table public.foods add constraint chk_foods_bounds check (
  char_length(name) between 1 and 200
  and serving_grams > 0 and serving_grams <= 10000
  and calories >= 0 and calories <= 20000
  and protein >= 0 and protein <= 1000
  and carbs >= 0 and carbs <= 1000
  and fat >= 0 and fat <= 1000
  and fiber >= 0 and fiber <= 1000
  and (serving_unit_grams is null or (serving_unit_grams > 0 and serving_unit_grams <= 10000))
);

alter table public.diet_logs drop constraint if exists chk_diet_logs_bounds;
alter table public.diet_logs add constraint chk_diet_logs_bounds check (
  date ~ '^\d{4}-\d{2}-\d{2}$'
  and char_length(food_name) between 1 and 200
  and serving_grams > 0 and serving_grams <= 10000
  and calories >= 0 and calories <= 50000
  and protein >= 0 and protein <= 2000
  and carbs >= 0 and carbs <= 2000
  and fat >= 0 and fat <= 2000
);

alter table public.water_logs drop constraint if exists chk_water_logs_bounds;
alter table public.water_logs add constraint chk_water_logs_bounds check (
  date ~ '^\d{4}-\d{2}-\d{2}$'
  and amount_ml <> 0
  and amount_ml between -10000 and 10000
);

alter table public.workout_routines drop constraint if exists chk_workout_routines_bounds;
alter table public.workout_routines add constraint chk_workout_routines_bounds check (
  char_length(name) between 1 and 120
);

alter table public.routine_exercises drop constraint if exists chk_routine_exercises_bounds;
alter table public.routine_exercises add constraint chk_routine_exercises_bounds check (
  char_length(name) between 1 and 120
  and target_sets between 1 and 50
  and default_rest_seconds between 0 and 3600
  and sort_order >= 0
);

alter table public.workout_sessions drop constraint if exists chk_workout_sessions_bounds;
alter table public.workout_sessions add constraint chk_workout_sessions_bounds check (
  date ~ '^\d{4}-\d{2}-\d{2}$'
  and char_length(routine_name) between 1 and 120
  and duration_minutes >= 0 and duration_minutes <= 1440
  and total_volume_kg >= 0 and total_volume_kg <= 1000000
);

alter table public.set_logs drop constraint if exists chk_set_logs_bounds;
alter table public.set_logs add constraint chk_set_logs_bounds check (
  char_length(exercise_name) between 1 and 120
  and set_number between 1 and 200
  and weight_kg >= 0 and weight_kg <= 2000
  and reps >= 0 and reps <= 1000
);

alter table public.body_logs drop constraint if exists chk_body_logs_bounds;
alter table public.body_logs add constraint chk_body_logs_bounds check (
  date ~ '^\d{4}-\d{2}-\d{2}$'
  and weight_kg >= 0 and weight_kg <= 500
  and (body_fat_pct is null or (body_fat_pct >= 1 and body_fat_pct <= 75))
  and (waist_cm is null or (waist_cm >= 10 and waist_cm <= 300))
  and (chest_cm is null or (chest_cm >= 10 and chest_cm <= 300))
  and (arms_cm is null or (arms_cm >= 10 and arms_cm <= 150))
  and (legs_cm is null or (legs_cm >= 10 and legs_cm <= 200))
  and jsonb_typeof(photo_uris) = 'array'
  and jsonb_array_length(photo_uris) <= 50
);

alter table public.custom_exercises drop constraint if exists chk_custom_exercises_bounds;
alter table public.custom_exercises add constraint chk_custom_exercises_bounds check (
  char_length(name) between 1 and 120
  and default_sets between 1 and 50
  and default_rest_seconds between 0 and 3600
);

-- =========================================================================
-- 3. Storage Bucket Hardening, Anon Revocation & Profile Column Protection
-- =========================================================================

update storage.buckets
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'body-photos';

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines in schema public from anon;

create or replace function public.protect_profile_immutable_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_immutable_columns on public.profiles;
create trigger trg_protect_profile_immutable_columns
  before update on public.profiles
  for each row
  execute function public.protect_profile_immutable_columns();

-- =========================================================================
-- 4. [A-06] Transactional Atomic RPCs (SECURITY INVOKER, search_path = '')
-- =========================================================================

create or replace function public.update_workout_routine_atomic(
  p_routine_id uuid,
  p_name text default null,
  p_description text default null,
  p_update_description boolean default false,
  p_sort_order integer default null,
  p_exercises jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.workout_routines r
    where r.id = p_routine_id
      and r.user_id = v_uid
  ) then
    raise exception 'Rotina não encontrada ou acesso negado.';
  end if;

  update public.workout_routines
  set
    name = coalesce(p_name, name),
    description = case when p_update_description then p_description else description end,
    sort_order = coalesce(p_sort_order, sort_order)
  where id = p_routine_id
    and user_id = v_uid;

  if p_exercises is not null then
    if jsonb_typeof(p_exercises) <> 'array' then
      raise exception 'Formato inválido para exercícios da rotina.';
    end if;

    delete from public.routine_exercises
    where routine_id = p_routine_id
      and user_id = v_uid;

    insert into public.routine_exercises (
      user_id,
      routine_id,
      name,
      muscle_group,
      target_sets,
      default_rest_seconds,
      sort_order
    )
    select
      v_uid,
      p_routine_id,
      coalesce(nullif(trim(elem.val->>'name'), ''), 'Exercício'),
      coalesce(elem.val->>'muscle_group', ''),
      coalesce((elem.val->>'target_sets')::integer, 3),
      coalesce((elem.val->>'default_rest_seconds')::integer, 60),
      coalesce((elem.val->>'sort_order')::integer, elem.idx::integer)
    from jsonb_array_elements(p_exercises) with ordinality as elem(val, idx);
  end if;
end;
$$;

revoke all on function public.update_workout_routine_atomic(uuid, text, text, boolean, integer, jsonb) from public, anon;
grant execute on function public.update_workout_routine_atomic(uuid, text, text, boolean, integer, jsonb) to authenticated;

create or replace function public.save_workout_session_atomic(
  p_routine_id uuid default null,
  p_routine_name text default 'Treino',
  p_date text default null,
  p_start_time text default null,
  p_end_time text default null,
  p_duration_minutes integer default 0,
  p_total_volume_kg double precision default 0,
  p_notes text default null,
  p_sets jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid;
  v_session public.workout_sessions%rowtype;
  v_sets jsonb := '[]'::jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_routine_id is not null and not exists (
    select 1
    from public.workout_routines r
    where r.id = p_routine_id
      and r.user_id = v_uid
  ) then
    raise exception 'Rotina inválida ou acesso negado.';
  end if;

  insert into public.workout_sessions (
    user_id,
    routine_id,
    routine_name,
    date,
    start_time,
    end_time,
    duration_minutes,
    total_volume_kg,
    notes
  )
  values (
    v_uid,
    p_routine_id,
    p_routine_name,
    p_date,
    p_start_time,
    p_end_time,
    coalesce(p_duration_minutes, 0),
    coalesce(p_total_volume_kg, 0),
    p_notes
  )
  returning * into v_session;

  if p_sets is not null and jsonb_typeof(p_sets) = 'array' and jsonb_array_length(p_sets) > 0 then
    with inserted_sets as (
      insert into public.set_logs (
        user_id,
        session_id,
        exercise_id,
        exercise_name,
        set_number,
        weight_kg,
        reps,
        completed
      )
      select
        v_uid,
        v_session.id,
        nullif(elem.val->>'exercise_id', ''),
        elem.val->>'exercise_name',
        coalesce((elem.val->>'set_number')::integer, elem.idx::integer),
        coalesce((elem.val->>'weight_kg')::double precision, 0),
        coalesce((elem.val->>'reps')::integer, 0),
        coalesce((elem.val->>'completed')::boolean, false)
      from jsonb_array_elements(p_sets) with ordinality as elem(val, idx)
      returning id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, completed, created_at
    )
    select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb)
    into v_sets
    from inserted_sets s;
  end if;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'routine_id', v_session.routine_id,
      'routine_name', v_session.routine_name,
      'date', v_session.date,
      'start_time', v_session.start_time,
      'end_time', v_session.end_time,
      'duration_minutes', v_session.duration_minutes,
      'total_volume_kg', v_session.total_volume_kg,
      'notes', v_session.notes,
      'created_at', v_session.created_at
    ),
    'sets', v_sets
  );
end;
$$;

revoke all on function public.save_workout_session_atomic(uuid, text, text, text, text, integer, double precision, text, jsonb) from public, anon;
grant execute on function public.save_workout_session_atomic(uuid, text, text, text, text, integer, double precision, text, jsonb) to authenticated;
