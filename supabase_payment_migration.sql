-- Supabase migration for existing INVOICE databases
-- Run this after the original schema.sql has already been applied.

alter table public.invoices
  add column if not exists payment_page_url text,
  add column if not exists payment_checkout_url text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists payment_generated_at timestamp with time zone,
  add column if not exists payment_link_sent_at timestamp with time zone,
  add column if not exists paid_at timestamp with time zone,
  add column if not exists payment_success_email_sent_at timestamp with time zone,
  add column if not exists payment_failure_email_sent_at timestamp with time zone,
  add column if not exists payment_error text;

alter table public.invoices
  alter column status set default 'saved';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'invoices'
      and constraint_name = 'invoices_status_check'
  ) then
    alter table public.invoices drop constraint invoices_status_check;
  end if;
end $$;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'saved', 'pending', 'paid', 'failed', 'cancelled'));

update public.invoices
set status = 'saved'
where status is null;

-- Optional: if you want the invoice number uniqueness enforced and it is missing,
-- uncomment the block below after confirming there are no duplicate invoice numbers.
-- do $$
-- begin
--   if not exists (
--     select 1
--     from information_schema.table_constraints
--     where table_schema = 'public'
--       and table_name = 'invoices'
--       and constraint_name = 'invoices_invoice_no_key'
--   ) then
--     alter table public.invoices add constraint invoices_invoice_no_key unique (invoice_no);
--   end if;
-- end $$;
