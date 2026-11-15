-- Add an optional photo to each Family post.
-- Run once in Supabase SQL Editor.
ALTER TABLE public.household_family_posts
  ADD COLUMN IF NOT EXISTS photo_url text;
-- Existing RLS on household_family_posts continues to govern access to posts.
-- Images use the existing public memories bucket. For truly private photos,
-- a private bucket and signed URLs must be implemented before production.
