-- EverMoment: multi-household journey links (STAGED MIGRATION)
-- REVIEW before running on production. Does not delete or reassign existing journeys.
-- Existing journeys.household_id remains supported during transition.
BEGIN;

-- Fail safely if the production schema differs from the verified structure.
-- This migration expects the singular household_member table, not household_members.
DO $preflight$
BEGIN
  IF to_regclass('public.household_member') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'household_member'
         AND column_name = 'household_id' AND udt_name = 'uuid'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'household_member'
         AND column_name = 'user_id' AND udt_name = 'uuid'
     ) THEN
    RAISE EXCEPTION 'Expected public.household_member(household_id uuid, user_id uuid); no changes applied';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.household_journeys (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  journey_row_id bigint NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES auth.users(id),
  shared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, journey_row_id)
);

CREATE INDEX IF NOT EXISTS household_journeys_journey_idx
  ON public.household_journeys (journey_row_id);

ALTER TABLE public.household_journeys ENABLE ROW LEVEL SECURITY;

-- Read links only for the owner of the destination house or its members.
-- SECURITY DEFINER helper avoids recursive household_member RLS evaluation.
CREATE OR REPLACE FUNCTION public.can_view_household_journey(p_household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.households h
            WHERE h.id = p_household_id AND h.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.household_member hm
               WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_household_journey(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_household_journey(uuid) TO authenticated;

DROP POLICY IF EXISTS "Household members can read journey shares" ON public.household_journeys;
CREATE POLICY "Household members can read journey shares"
ON public.household_journeys FOR SELECT TO authenticated
USING (public.can_view_household_journey(household_id));

-- Ownership is checked server-side against customers.auth_user_id, not localStorage.
-- Only share into a house where the signed-in user is owner or member.
CREATE OR REPLACE FUNCTION public.share_journey_to_household(
  p_journey_row_id bigint,
  p_household_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.journeys j
    JOIN public.customers c ON c.id = j.customer_id
    WHERE j.id = p_journey_row_id AND c.auth_user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Only the journey owner can share'; END IF;
  IF NOT public.can_view_household_journey(p_household_id) THEN
    RAISE EXCEPTION 'Not a member of destination household';
  END IF;
  INSERT INTO public.household_journeys (household_id, journey_row_id, shared_by)
  VALUES (p_household_id, p_journey_row_id, auth.uid())
  ON CONFLICT (household_id, journey_row_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.share_journey_to_household(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.share_journey_to_household(bigint, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unshare_journey_from_household(
  p_journey_row_id bigint,
  p_household_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.journeys j
    JOIN public.customers c ON c.id = j.customer_id
    WHERE j.id = p_journey_row_id AND c.auth_user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Only the journey owner can unshare'; END IF;
  DELETE FROM public.household_journeys
  WHERE journey_row_id = p_journey_row_id AND household_id = p_household_id;
END;
$$;
REVOKE ALL ON FUNCTION public.unshare_journey_from_household(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unshare_journey_from_household(bigint, uuid) TO authenticated;

COMMIT;

-- IMPORTANT: This migration creates share links only.
-- journeys and journey_moments SELECT RLS policies must be updated in a
-- separate reviewed migration before shared content becomes readable.
-- Do not create broad public read policies or change storage bucket access.
