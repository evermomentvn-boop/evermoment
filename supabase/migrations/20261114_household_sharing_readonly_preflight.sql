-- EverMoment: READ-ONLY preflight for household journey sharing.
-- Run in Supabase SQL Editor before either staged migration.
-- This script does not write data, alter policies, or expose user content.
WITH required_columns(table_name, column_name, expected_type) AS (
 VALUES
 ('households','id','uuid'), ('households','created_by','uuid'),
 ('household_members','household_id','uuid'), ('household_members','user_id','uuid'),
 ('customers','id','uuid'), ('customers','auth_user_id','uuid'),
 ('journeys','id','int8'), ('journeys','journey_id','text'),
 ('journeys','customer_id','uuid'), ('journeys','household_id','uuid'),
 ('journey_moments','journey_id','text'), ('journey_moments','customer_id','uuid')
)
SELECT 'column' AS check_type, r.table_name || '.' || r.column_name AS item,
       CASE WHEN c.udt_name = r.expected_type THEN 'OK'
            WHEN c.udt_name IS NULL THEN 'MISSING'
            ELSE 'TYPE MISMATCH: ' || c.udt_name END AS status
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
UNION ALL
SELECT 'RLS', x.relname,
       CASE WHEN x.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END
FROM pg_class x JOIN pg_namespace n ON n.oid=x.relnamespace
WHERE n.nspname='public' AND x.relname IN
 ('journeys','journey_moments','household_members','households','customers','household_journeys')
UNION ALL
SELECT 'table', 'public.household_journeys',
       CASE WHEN to_regclass('public.household_journeys') IS NULL
            THEN 'NOT INSTALLED (expected before stage 1)' ELSE 'EXISTS' END
ORDER BY check_type, item;

-- Read-only policy inventory; do not change Storage policies until existing
-- getPublicUrl() callers are migrated to signed URLs.
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('households','household_members','customers',
                    'journeys','journey_moments','household_journeys')
ORDER BY tablename, policyname;

SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='storage' AND tablename='objects'
ORDER BY policyname;

-- Validate the two RPC signatures after stage 1 (no invocation).
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('can_view_household_journey','share_journey_to_household',
  'unshare_journey_from_household','can_read_shared_journey',
  'can_read_shared_journey_moments')
ORDER BY p.proname;
