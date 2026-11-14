-- EverMoment shared-household read permissions, stage 2.
-- Requires 20261108_household_journeys_staged.sql applied first.
-- Additive policies: preserve existing personal and legacy household access.
-- Review current RLS/storage policies and test with two accounts before production.
BEGIN;

-- Abort atomically if prerequisites or row-level security are missing.
-- This avoids silently installing read policies on an unexpected schema.
DO $preflight$
BEGIN
  IF to_regclass('public.household_journeys') IS NULL
     OR to_regclass('public.journeys') IS NULL
     OR to_regclass('public.journey_moments') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'journeys' AND c.relrowsecurity
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'journey_moments' AND c.relrowsecurity
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'journeys'
         AND column_name = 'id' AND udt_name = 'int8'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'journey_moments'
         AND column_name = 'journey_id' AND udt_name = 'text'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'journey_moments'
         AND column_name = 'customer_id' AND udt_name = 'uuid'
     ) THEN
    RAISE EXCEPTION 'Shared journey read-policy preflight failed; no changes applied';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.can_read_shared_journey(p_journey_row_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.household_journeys hj
    WHERE hj.journey_row_id = p_journey_row_id
      AND public.can_view_household_journey(hj.household_id)
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_shared_journey(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_shared_journey(bigint) TO authenticated;

-- Every member sees all journeys explicitly placed in their household.
DROP POLICY IF EXISTS "Household members read linked journeys" ON public.journeys;
CREATE POLICY "Household members read linked journeys"
ON public.journeys FOR SELECT TO authenticated
USING (public.can_read_shared_journey(id));

-- Moments are scoped to BOTH journey_id and customer_id to avoid collisions.
-- A shared journey makes its journey moments readable, not the owner's raw media vault.
CREATE OR REPLACE FUNCTION public.can_read_shared_journey_moments(
  p_journey_id text, p_customer_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.journeys j
    JOIN public.household_journeys hj ON hj.journey_row_id = j.id
    WHERE j.journey_id = p_journey_id AND j.customer_id = p_customer_id
      AND public.can_view_household_journey(hj.household_id)
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_shared_journey_moments(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_shared_journey_moments(text, uuid) TO authenticated;

DROP POLICY IF EXISTS "Household members read linked journey moments" ON public.journey_moments;
CREATE POLICY "Household members read linked journey moments"
ON public.journey_moments FOR SELECT TO authenticated
USING (public.can_read_shared_journey_moments(journey_id, customer_id));

COMMIT;

-- Important: check storage.objects policies separately. Database RLS cannot
-- guarantee privacy if the underlying storage bucket or URLs are public.
-- Do not grant SELECT on customers or the raw media storage bucket here.
