-- EverMoment | Preflight for sharing one journey to multiple households
-- READ ONLY. Run in Supabase SQL Editor and send results before applying migrations.
-- No INSERT, UPDATE, DELETE, CREATE, ALTER, or DROP.
SELECT 'journey_key_duplicates' AS check_name,
       COUNT(*)::text AS result
FROM (
  SELECT journey_id, customer_id
  FROM public.journeys
  GROUP BY journey_id, customer_id
  HAVING COUNT(*) > 1
) duplicates
UNION ALL
SELECT 'journey_null_keys', COUNT(*)::text
FROM public.journeys
WHERE journey_id IS NULL OR customer_id IS NULL
UNION ALL
SELECT 'customer_owner_mapping_missing', COUNT(*)::text
FROM public.journeys j
LEFT JOIN public.customers c ON c.id = j.customer_id
WHERE c.id IS NULL OR c.auth_user_id IS NULL
UNION ALL
SELECT 'existing_household_journeys_table', COUNT(*)::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'household_journeys'
UNION ALL
SELECT 'journeys_composite_unique_constraint', COUNT(*)::text
FROM pg_constraint
WHERE conrelid = 'public.journeys'::regclass
  AND contype IN ('u','p')
  AND (
    SELECT array_agg(a.attname ORDER BY a.attname)
    FROM unnest(conkey) AS k(attnum)
    JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k.attnum
  ) = ARRAY['customer_id','journey_id']::text[]
ORDER BY check_name;
