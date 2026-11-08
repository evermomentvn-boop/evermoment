-- EverMoment: multi-household journey sharing (stage 1 / schema only)
-- REVIEW BEFORE RUNNING IN SUPABASE. This file is not applied automatically.
-- The existing journeys.household_id and its policies remain untouched.
-- Stage 2 must update journeys / journey_moments SELECT policies before enabling the UI.
BEGIN;

CREATE TABLE IF NOT EXISTS public.household_journeys (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  journey_id text NOT NULL,
  customer_id uuid NOT NULL,
  shared_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, journey_id, customer_id),
  CONSTRAINT household_journeys_journey_owner_fk
    FOREIGN KEY (journey_id, customer_id)
    REFERENCES public.journeys(journey_id, customer_id)
);

-- This migration requires a unique index on journeys(journey_id, customer_id).
-- If that constraint does not exist, PostgreSQL will reject the FK and roll back.
-- Do not add a UNIQUE constraint without checking existing duplicates first.

ALTER TABLE public.household_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view shared journey links"
ON public.household_journeys FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = household_journeys.household_id AND h.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_journeys.household_id AND hm.user_id = auth.uid()
  )
);

-- Write permissions intentionally omitted until customer ownership mapping
-- and the existing RLS / Edge Function write paths are verified.
COMMIT;
