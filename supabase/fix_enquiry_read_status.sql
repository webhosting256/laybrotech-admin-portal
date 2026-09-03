-- Align legacy enquiry statuses with the admin inbox workflow.
-- Existing rows are retained and mapped to the current vocabulary.

alter table public.enquiries drop constraint if exists enquiries_status_check;

update public.enquiries
set status = 'read'
where status = 'in_progress';

update public.enquiries
set status = 'resolved'
where status = 'closed';

alter table public.enquiries add constraint enquiries_status_check
  check (status in ('new', 'read', 'resolved'));
