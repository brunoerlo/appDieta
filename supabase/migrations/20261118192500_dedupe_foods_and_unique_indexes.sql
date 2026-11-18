-- =========================================================================
-- Migration: 20261118192500_dedupe_foods_and_unique_indexes.sql
-- Purpose: Deduplicate existing public.foods rows created by repeated
--          Open Food Facts caching and enforce unique partial indexes
--          for barcode and openfoodfacts (user_id, name_normalized, source).
-- =========================================================================

-- 1. Backfill missing name_normalized if any
update public.foods
set name_normalized = lower(trim(name))
where name_normalized is null or name_normalized = '';

-- 2. Remove duplicate rows sharing (user_id, barcode), keeping the oldest row
delete from public.foods f
using (
  select id,
         row_number() over (
           partition by user_id, barcode
           order by created_at asc, id asc
         ) as rn
  from public.foods
  where barcode is not null and barcode <> ''
) dup
where f.id = dup.id
  and dup.rn > 1;

-- 3. Remove duplicate openfoodfacts/recipe rows sharing (user_id, source, name_normalized), keeping the oldest row
delete from public.foods f
using (
  select id,
         row_number() over (
           partition by user_id, source, name_normalized
           order by created_at asc, id asc
         ) as rn
  from public.foods
  where source in ('openfoodfacts', 'recipe')
    and name_normalized is not null
    and name_normalized <> ''
) dup
where f.id = dup.id
  and dup.rn > 1;

-- 4. Prevent future duplicate barcode or openfoodfacts food entries per user
create unique index if not exists uq_foods_user_barcode
  on public.foods (user_id, barcode)
  where barcode is not null and barcode <> '';

create unique index if not exists uq_foods_user_off_name
  on public.foods (user_id, name_normalized, source)
  where source = 'openfoodfacts' and name_normalized is not null and name_normalized <> '';
