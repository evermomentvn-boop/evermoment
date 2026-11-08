-- EverMoment: read-only audit for a safe private-storage migration.
-- Run SELECT statements individually in Supabase SQL Editor.
-- No object names, file URLs, passwords, or email addresses are returned.

-- A. Customer folder mapping: legacy and Google SSO may use different prefixes.
SELECT
  COUNT(*) AS total_customers,
  COUNT(*) FILTER (WHERE auth_user_id IS NULL) AS customers_without_google_auth,
  COUNT(*) FILTER (WHERE folder_name IS NULL OR btrim(folder_name) = '') AS customers_without_folder,
  COUNT(*) FILTER (WHERE auth_user_id IS NOT NULL AND folder_name = auth_user_id::text) AS google_folder_matches_auth_uid,
  COUNT(*) FILTER (WHERE auth_user_id IS NOT NULL AND folder_name IS DISTINCT FROM auth_user_id::text) AS google_folder_differs_from_auth_uid,
  COUNT(DISTINCT folder_name) AS distinct_folder_names
FROM public.customers;

-- B. Duplicate folder assignments would make path-only ownership ambiguous.
SELECT COUNT(*) AS duplicate_folder_groups
FROM (
  SELECT folder_name FROM public.customers
  WHERE folder_name IS NOT NULL
  GROUP BY folder_name HAVING COUNT(*) > 1
) d;

-- C. Media objects by top-level folder category; no file names or folder values.
SELECT
  COUNT(*) AS total_objects,
  COUNT(*) FILTER (WHERE name NOT LIKE '%/%') AS objects_without_folder,
  COUNT(*) FILTER (WHERE name LIKE '%/%') AS objects_with_folder,
  COUNT(*) FILTER (WHERE name LIKE '%/thumb-%' OR name LIKE '%/thumb-video-%') AS thumbnail_objects
FROM storage.objects WHERE bucket_id = 'memories';

-- D. Does the first folder segment map to exactly one customer?
WITH prefixes AS (
  SELECT split_part(name, '/', 1) AS prefix
  FROM storage.objects WHERE bucket_id = 'memories'
), counts AS (
  SELECT p.prefix, COUNT(c.id) AS matches
  FROM (SELECT DISTINCT prefix FROM prefixes) p
  LEFT JOIN public.customers c ON c.folder_name = p.prefix
  GROUP BY p.prefix
)
SELECT
  (SELECT COUNT(*) FROM prefixes) AS total_objects,
  (SELECT COUNT(*) FROM prefixes p JOIN counts c USING (prefix) WHERE c.matches = 0) AS objects_with_unmapped_prefix,
  (SELECT COUNT(*) FROM prefixes p JOIN counts c USING (prefix) WHERE c.matches > 1) AS objects_with_ambiguous_prefix;

-- E. Storage ownership metadata may be missing for older uploads.
SELECT COUNT(*) AS total_objects,
       COUNT(*) FILTER (WHERE owner_id IS NULL) AS objects_without_owner_id
FROM storage.objects WHERE bucket_id = 'memories';

-- F. Storage policy snapshot (read-only).
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- STOP: do not switch the bucket to private or drop policies yet.
