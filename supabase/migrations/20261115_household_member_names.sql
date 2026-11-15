-- EverMoment: show each member by their own House name, not Google profile.
-- Execute in Supabase SQL Editor. No data is changed.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_household_member_names(p_household_id uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = p_household_id AND h.created_by = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to view household members';
  END IF;
  RETURN QUERY
  SELECT hm.user_id,
    COALESCE(
      NULLIF(btrim(own_house.name), ''),
      'Chưa đặt tên Nhà'
    )::text
  FROM public.household_members hm
  LEFT JOIN LATERAL (
    SELECT h.name FROM public.households h
    WHERE h.created_by = hm.user_id
    ORDER BY h.id
    LIMIT 1
  ) own_house ON true
  WHERE hm.household_id = p_household_id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_household_member_names(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_household_member_names(uuid) TO authenticated;
COMMIT;
