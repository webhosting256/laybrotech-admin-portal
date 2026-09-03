-- Add fields already used by the admin post editor.
-- This migration is additive and preserves existing posts.

alter table public.blog_posts
  add column if not exists focus_keyword text,
  add column if not exists seo_keywords text[];

