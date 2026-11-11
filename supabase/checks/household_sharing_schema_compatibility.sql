-- EverMoment | Read-only schema compatibility check for staged household sharing.
-- Run in Supabase SQL Editor. No data or schema changes.
-- Share the results (column names and types only; no user data).
SELECT 'table' AS item_type, t.table_name AS object_name,
       '' AS detail, '' AS data_type
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_name IN ('households','household_member','household_members',
                       'customers','journeys','journey_moments','household_journeys')
UNION ALL
SELECT 'column', c.table_name, c.column_name, c.data_type ||
       COALESCE(' (' || c.udt_name || ')', '')
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('households','household_member','household_members',
                       'customers','journeys','journey_moments','household_journeys')
  AND c.column_name IN ('id','created_by','user_id','role','household_id',
                        'auth_user_id','customer_id','journey_id','moment_data')
ORDER BY item_type, object_name, detail;
