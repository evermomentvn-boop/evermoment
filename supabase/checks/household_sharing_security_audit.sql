-- EverMoment READ-ONLY security audit before applying household sharing migrations.
-- Run in Supabase SQL Editor. No changes are made.
-- 1. Current RLS policy expressions for household, journey and storage tables.
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('households','household_members','customers','journeys','journey_moments','household_journeys')
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
  AND table_name IN ('households','household_members','customers','journeys','journey_moments','household_journeys')
  AND column_name IN ('id','created_by','user_id','household_id','auth_user_id','customer_id','journey_id','moment_data')
ORDER BY table_name, column_name;

-- 5. RLS enabled? Note: FORCE ROW LEVEL SECURITY may be separately configured.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('households','household_members','customers','journeys','journey_moments','household_journeys')
ORDER BY c.relname;
