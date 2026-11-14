-- EverMoment READ-ONLY security audit before applying household sharing migrations.
-- Run in Supabase SQL Editor. No changes are made.
-- 1. Current RLS policy expressions for household, journey and storage tables.
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('households','household_member','customers','journeys','journey_moments','household_journeys')
ORDER BY tablename, policyname;

-- 2. Storage policies: public bucket access must be reviewed separately.
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- 3. Bucket visibility (no object names or media are exposed by this query).
SELECT id, name, public FROM storage.buckets ORDER BY id;

-- 4. Ensure tables and columns used by the staged migrations exist.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('households','household_member','customers','journeys','journey_moments','household_journeys')
  AND column_name IN ('id','created_by','user_id','household_id','auth_user_id','customer_id','journey_id','moment_data')
ORDER BY table_name, column_name;

-- 5. RLS enabled? Note: FORCE ROW LEVEL SECURITY may be separately configured.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('households','household_member','customers','journeys','journey_moments','household_journeys')
ORDER BY c.relname;

-- 6. Exact column types needed by the staged share/RLS migrations.
-- The migration assumes journeys.id=bigint, households.id=uuid,
-- customers.id=journeys.customer_id=journey_moments.customer_id=uuid,
-- and journey_moments.journey_id=text. Check rather than guess.
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'households' AND column_name IN ('id','created_by')) OR
    (table_name = 'household_member' AND column_name IN ('household_id','user_id')) OR
    (table_name = 'customers' AND column_name IN ('id','auth_user_id')) OR
    (table_name = 'journeys' AND column_name IN ('id','customer_id','journey_id','household_id')) OR
    (table_name = 'journey_moments' AND column_name IN ('customer_id','journey_id'))
  )
ORDER BY table_name, column_name;

-- 7. Verify actual foreign keys; no data or credentials returned.
SELECT conrelid::regclass::text AS table_name, conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  AND conrelid IN ('public.household_member'::regclass,
                   'public.households'::regclass,
                   'public.customers'::regclass,
                   'public.journeys'::regclass,
                   'public.journey_moments'::regclass)
ORDER BY table_name, constraint_name;
