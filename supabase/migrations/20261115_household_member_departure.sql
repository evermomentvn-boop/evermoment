-- EverMoment: atomic removal/leave, preserving source journeys and media.
-- Run manually in Supabase SQL Editor after reviewing. No data is changed by installing functions.
BEGIN;

CREATE OR REPLACE FUNCTION public.remove_household_member_and_shares(
  p_household_id uuid, p_member_user_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = p_household_id AND h.created_by = auth.uid()
  ) THEN RAISE EXCEPTION 'Only the house owner can remove members'; END IF;
  IF p_member_user_id IS NULL OR p_member_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove house owner'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.user_id = p_member_user_id
      AND hm.role = 'member'
  ) THEN RAISE EXCEPTION 'Member not found'; END IF;

  -- Remove only links created by this member, not their original journeys or links to other houses.
  DELETE FROM public.household_journeys hj
  WHERE hj.household_id = p_household_id AND hj.shared_by = p_member_user_id;

  DELETE FROM public.household_members hm
  WHERE hm.household_id = p_household_id AND hm.user_id = p_member_user_id
    AND hm.role = 'member';
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_household_and_shares(
  p_household_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = p_household_id AND h.created_by = auth.uid()
  ) THEN RAISE EXCEPTION 'Owner cannot leave their own house'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
      AND hm.role = 'member'
  ) THEN RAISE EXCEPTION 'Not a member of this house'; END IF;

  DELETE FROM public.household_journeys hj
  WHERE hj.household_id = p_household_id AND hj.shared_by = auth.uid();

  DELETE FROM public.household_members hm
  WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
    AND hm.role = 'member';
END;
$$;

REVOKE ALL ON FUNCTION public.remove_household_member_and_shares(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_household_and_shares(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_household_member_and_shares(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_household_and_shares(uuid) TO authenticated;
COMMIT;
