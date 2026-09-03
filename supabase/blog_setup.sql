-- Laybrotech Blog CMS schema
-- Run in the Supabase SQL editor for the project used by the admin dashboard.
-- Security model: this is an internal dashboard. Supabase Auth users are trusted admins.
-- Never expose service_role keys in the browser application.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  featured_image_url text,
  featured_image_path text,
  featured_image_alt text,
  category_id uuid references public.blog_categories(id) on delete set null,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  status text not null default 'draft',
  seo_title text,
  meta_description text,
  focus_keyword text,
  seo_keywords text[],
  canonical_url text,
  is_featured boolean not null default false,
  allow_comments boolean not null default true,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_status_check check (status in ('draft', 'published', 'scheduled', 'archived'))
);

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  name text not null,
  email text not null,
  comment text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint blog_comments_status_check check (status in ('pending', 'approved', 'rejected', 'spam'))
);

create table if not exists public.blog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.is_blog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blog_admins admin
    where admin.user_id = auth.uid()
  );
$$;

grant execute on function public.is_blog_admin() to anon, authenticated;
create index if not exists blog_posts_status_idx on public.blog_posts(status);
create index if not exists blog_posts_category_id_idx on public.blog_posts(category_id);
create index if not exists blog_posts_published_at_idx on public.blog_posts(published_at desc);
create index if not exists blog_posts_scheduled_at_idx on public.blog_posts(scheduled_at desc);
create index if not exists blog_comments_post_id_idx on public.blog_comments(post_id);
create index if not exists blog_comments_status_idx on public.blog_comments(status);

alter table public.blog_categories add column if not exists description text;
alter table public.blog_categories add column if not exists updated_at timestamptz not null default now();
alter table public.blog_posts add column if not exists featured_image_path text;
alter table public.blog_posts add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table public.blog_posts add column if not exists author_name text;
alter table public.blog_posts add column if not exists canonical_url text;
alter table public.blog_posts add column if not exists focus_keyword text;
alter table public.blog_posts add column if not exists seo_keywords text[];
alter table public.blog_posts add column if not exists is_featured boolean not null default false;
alter table public.blog_posts add column if not exists allow_comments boolean not null default true;
alter table public.blog_posts add column if not exists scheduled_at timestamptz;

alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts add constraint blog_posts_status_check check (status in ('draft', 'published', 'scheduled', 'archived'));

drop trigger if exists set_blog_posts_updated_at on public.blog_posts;
create trigger set_blog_posts_updated_at before update on public.blog_posts for each row execute function public.set_updated_at();

drop trigger if exists set_blog_categories_updated_at on public.blog_categories;
create trigger set_blog_categories_updated_at before update on public.blog_categories for each row execute function public.set_updated_at();

alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_comments enable row level security;
alter table public.blog_admins enable row level security;

drop policy if exists "Blog admins can read admin allowlist" on public.blog_admins;
create policy "Blog admins can read admin allowlist" on public.blog_admins for select to authenticated using (public.is_blog_admin());

-- Categories and tags are public taxonomy. Authenticated admins manage them.
drop policy if exists "Public can read blog categories" on public.blog_categories;
create policy "Public can read blog categories" on public.blog_categories for select to anon, authenticated using (true);
drop policy if exists "Authenticated admins can manage blog categories" on public.blog_categories;
create policy "Authenticated admins can manage blog categories" on public.blog_categories for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());

drop policy if exists "Public can read blog tags" on public.blog_tags;
create policy "Public can read blog tags" on public.blog_tags for select to anon, authenticated using (true);
drop policy if exists "Authenticated admins can manage blog tags" on public.blog_tags;
create policy "Authenticated admins can manage blog tags" on public.blog_tags for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());

drop policy if exists "Public can read visible blog post tags" on public.blog_post_tags;
create policy "Public can read visible blog post tags" on public.blog_post_tags for select to anon, authenticated using (
  exists (
    select 1 from public.blog_posts p
    where p.id = blog_post_tags.post_id
    and (p.status = 'published' or (p.status = 'scheduled' and p.scheduled_at <= now()))
  ) or public.is_blog_admin()
);
drop policy if exists "Authenticated admins can manage blog post tags" on public.blog_post_tags;
create policy "Authenticated admins can manage blog post tags" on public.blog_post_tags for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());

-- Posts: anonymous users read only public-visible posts. Admins manage all.
drop policy if exists "Public can read public blog posts" on public.blog_posts;
create policy "Public can read public blog posts" on public.blog_posts for select to anon using (
  status = 'published' or (status = 'scheduled' and scheduled_at <= now())
);
drop policy if exists "Authenticated admins can manage blog posts" on public.blog_posts;
create policy "Authenticated admins can manage blog posts" on public.blog_posts for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());

-- Comments: public may read approved comments and submit pending comments on comment-enabled public posts.
drop policy if exists "Public can read approved comments" on public.blog_comments;
create policy "Public can read approved comments" on public.blog_comments for select to anon, authenticated using (status = 'approved' or public.is_blog_admin());
drop policy if exists "Public can submit pending comments" on public.blog_comments;
create policy "Public can submit pending comments" on public.blog_comments for insert to anon with check (
  status = 'pending'
  and exists (
    select 1 from public.blog_posts p
    where p.id = blog_comments.post_id
    and p.allow_comments = true
    and (p.status = 'published' or (p.status = 'scheduled' and p.scheduled_at <= now()))
  )
);
drop policy if exists "Authenticated admins can manage comments" on public.blog_comments;
create policy "Authenticated admins can manage comments" on public.blog_comments for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());

insert into public.blog_categories (name, slug, description)
values
  ('Web Hosting', 'web-hosting', 'Hosting guidance and infrastructure topics.'),
  ('Website Design', 'website-design', 'Website planning, design, and optimization.'),
  ('Software Development', 'software-development', 'Custom software and digital systems.'),
  ('Digital Marketing', 'digital-marketing', 'SEO, campaigns, and online growth.'),
  ('Business Technology', 'business-technology', 'Practical technology for business operations.'),
  ('Company News', 'company-news', 'Laybrotech updates and announcements.')
on conflict (slug) do nothing;

insert into public.blog_admins (user_id, email)
select id, email
from auth.users
where lower(email) in (
  lower('info@laybrotech.com'),
  lower('webhosting256ug@gmail.com')
)
on conflict (user_id) do update set email = excluded.email;
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read blog images" on storage.objects;
create policy "Public can read blog images" on storage.objects for select to anon, authenticated using (bucket_id = 'blog-images');
drop policy if exists "Authenticated admins can upload blog images" on storage.objects;
create policy "Authenticated admins can upload blog images" on storage.objects for insert to authenticated with check (bucket_id = 'blog-images' and public.is_blog_admin());
drop policy if exists "Authenticated admins can update blog images" on storage.objects;
create policy "Authenticated admins can update blog images" on storage.objects for update to authenticated using (bucket_id = 'blog-images' and public.is_blog_admin()) with check (bucket_id = 'blog-images' and public.is_blog_admin());
drop policy if exists "Authenticated admins can delete blog images" on storage.objects;
create policy "Authenticated admins can delete blog images" on storage.objects for delete to authenticated using (bucket_id = 'blog-images' and public.is_blog_admin());

-- Scheduled publishing strategy:
-- No background task is required. Public queries treat scheduled posts as visible only when scheduled_at <= now().

