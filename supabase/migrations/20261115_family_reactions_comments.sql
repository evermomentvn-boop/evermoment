-- Family reactions and comments: only members of the receiving House can interact.
BEGIN;
CREATE TABLE IF NOT EXISTS public.household_family_reactions (
  post_id bigint NOT NULL REFERENCES public.household_family_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('❤️','🥰','😂','👍','😮','😢')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.household_family_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES public.household_family_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_comments_post_idx ON public.household_family_comments(post_id, created_at);
ALTER TABLE public.household_family_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_family_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS family_reactions_read ON public.household_family_reactions;
CREATE POLICY family_reactions_read ON public.household_family_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.household_family_posts p WHERE p.id = post_id));
DROP POLICY IF EXISTS family_reactions_insert ON public.household_family_reactions;
CREATE POLICY family_reactions_insert ON public.household_family_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.household_family_posts p WHERE p.id = post_id));
DROP POLICY IF EXISTS family_reactions_update ON public.household_family_reactions;
CREATE POLICY family_reactions_update ON public.household_family_reactions FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.household_family_posts p WHERE p.id = post_id))
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.household_family_posts p WHERE p.id = post_id));
DROP POLICY IF EXISTS family_reactions_delete ON public.household_family_reactions;
CREATE POLICY family_reactions_delete ON public.household_family_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());
DROP POLICY IF EXISTS family_comments_read ON public.household_family_comments;
CREATE POLICY family_comments_read ON public.household_family_comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.household_family_posts p WHERE p.id = post_id));
DROP POLICY IF EXISTS family_comments_insert ON public.household_family_comments;
CREATE POLICY family_comments_insert ON public.household_family_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.household_family_posts p WHERE p.id = post_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_family_reactions TO authenticated;
GRANT SELECT, INSERT ON public.household_family_comments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.household_family_comments_id_seq TO authenticated;
COMMIT;
