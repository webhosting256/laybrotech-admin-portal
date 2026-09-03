-- Authorize the existing Supabase Auth user for the Laybrotech admin dashboard.
-- Run this in the same Supabase project's SQL Editor after creating the Auth user.

do $$
declare
  admin_user_id uuid;
  admin_email text;
begin
  select id, email
  into admin_user_id, admin_email
  from auth.users
  where lower(email) = lower('webhosting256ug@gmail.com')
  limit 1;

  if admin_user_id is null then
    raise exception 'No Supabase Auth user exists for webhosting256ug@gmail.com';
  end if;

  insert into public.blog_admins (user_id, email)
  values (admin_user_id, admin_email)
  on conflict (user_id) do update
    set email = excluded.email;
end
$$;

notify pgrst, 'reload schema';
