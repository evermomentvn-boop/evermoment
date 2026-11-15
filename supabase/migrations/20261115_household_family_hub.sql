-- Family hub: messages, family dates, and stories scoped to each House.
-- Run once in Supabase SQL Editor. Existing data remains untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS public.household_family_posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('message','date','story')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 3000),
  event_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_date_required CHECK (kind <> 'date' OR event_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS household_family_posts_house_time
  ON public.household_family_posts(household_id, created_at DESC);
ALTER TABLE public.household_family_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS family_posts_select_house_members ON public.household_family_posts;
CREATE POLICY family_posts_select_house_members ON public.household_family_posts
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.households h
    WHERE h.id = household_id AND h.created_by = (SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_id AND hm.user_id = (SELECT auth.uid()))
);
DROP POLICY IF EXISTS family_posts_insert_house_members ON public.household_family_posts;
CREATE POLICY family_posts_insert_house_members ON public.household_family_posts
FOR INSERT TO authenticated WITH CHECK (
  author_id = (SELECT auth.uid()) AND (
    EXISTS (SELECT 1 FROM public.households h
      WHERE h.id = household_id AND h.created_by = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_id AND hm.user_id = (SELECT auth.uid()))
  )
);
GRANT SELECT, INSERT ON public.household_family_posts TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.household_family_posts_id_seq TO authenticated;
COMMIT;
