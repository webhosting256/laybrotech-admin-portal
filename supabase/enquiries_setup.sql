-- Laybrotech contact enquiries schema
-- Run in the same Supabase project used by the public website and admin dashboard.
-- Public visitors can insert enquiries only. Authenticated Laybrotech admins can manage them.
-- Never expose service_role keys in browser applications.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  company text,
  subject text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enquiries_status_check check (status in ('new', 'read', 'resolved'))
);

-- Upgrade projects created with the legacy status vocabulary.
alter table public.enquiries drop constraint if exists enquiries_status_check;

update public.enquiries set status = 'read' where status = 'in_progress';
update public.enquiries set status = 'resolved' where status = 'closed';

alter table public.enquiries drop constraint if exists enquiries_status_check;
alter table public.enquiries add constraint enquiries_status_check
  check (status in ('new', 'read', 'resolved'));

notify pgrst, 'reload schema';


create index if not exists enquiries_status_idx on public.enquiries(status);
create index if not exists enquiries_created_at_idx on public.enquiries(created_at desc);
create index if not exists enquiries_email_idx on public.enquiries(email);

drop trigger if exists set_enquiries_updated_at on public.enquiries;
create trigger set_enquiries_updated_at before update on public.enquiries for each row execute function public.set_updated_at();

grant insert on public.enquiries to anon;
grant select, update, delete on public.enquiries to authenticated;

alter table public.enquiries enable row level security;

-- Anonymous visitors may submit only new enquiries and cannot read/update/delete existing rows.
drop policy if exists "Public can submit enquiries" on public.enquiries;
create policy "Public can submit enquiries" on public.enquiries for insert to anon with check (status = 'new');

-- Authenticated Laybrotech admins can view, update, and delete enquiries.
drop policy if exists "Authenticated admins can read enquiries" on public.enquiries;
create policy "Authenticated admins can read enquiries" on public.enquiries for select to authenticated using (public.is_blog_admin());

drop policy if exists "Authenticated admins can update enquiries" on public.enquiries;
create policy "Authenticated admins can update enquiries" on public.enquiries for update to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());

drop policy if exists "Authenticated admins can delete enquiries" on public.enquiries;
create policy "Authenticated admins can delete enquiries" on public.enquiries for delete to authenticated using (public.is_blog_admin());
