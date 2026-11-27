begin;

alter table public.cash_movements
  add column if not exists particulars text;

alter table public.sms_capture_inbox
  add column if not exists user_particulars text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cash_movements_particulars_length_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_particulars_length_check
      check (particulars is null or char_length(btrim(particulars)) between 2 and 80) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sms_capture_inbox_user_particulars_length_check'
      and conrelid = 'public.sms_capture_inbox'::regclass
  ) then
    alter table public.sms_capture_inbox
      add constraint sms_capture_inbox_user_particulars_length_check
      check (user_particulars is null or char_length(btrim(user_particulars)) between 2 and 80) not valid;
  end if;
end;
$$;

alter table public.cash_movements
  validate constraint cash_movements_particulars_length_check;

alter table public.sms_capture_inbox
  validate constraint sms_capture_inbox_user_particulars_length_check;

create table if not exists public.cashbook_merchant_particulars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null check (char_length(btrim(merchant_key)) between 2 and 100),
  merchant_name text not null check (char_length(btrim(merchant_name)) between 2 and 100),
  particulars text not null check (char_length(btrim(particulars)) between 2 and 80),
  usage_count integer not null default 1 check (usage_count > 0),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashbook_merchant_particulars_user_merchant_label_uq
    unique (user_id, merchant_key, particulars)
);

create index if not exists cashbook_merchant_particulars_lookup_idx
  on public.cashbook_merchant_particulars
  (user_id, merchant_key, usage_count desc, last_used_at desc);

alter table public.cashbook_merchant_particulars enable row level security;

drop policy if exists cashbook_merchant_particulars_select_own on public.cashbook_merchant_particulars;
drop policy if exists cashbook_merchant_particulars_insert_own on public.cashbook_merchant_particulars;
drop policy if exists cashbook_merchant_particulars_update_own on public.cashbook_merchant_particulars;
drop policy if exists cashbook_merchant_particulars_delete_own on public.cashbook_merchant_particulars;

create policy cashbook_merchant_particulars_select_own
  on public.cashbook_merchant_particulars
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy cashbook_merchant_particulars_insert_own
  on public.cashbook_merchant_particulars
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy cashbook_merchant_particulars_update_own
  on public.cashbook_merchant_particulars
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy cashbook_merchant_particulars_delete_own
  on public.cashbook_merchant_particulars
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.cashbook_merchant_particulars from anon;
grant select, insert, update, delete on public.cashbook_merchant_particulars to authenticated;
grant all on public.cashbook_merchant_particulars to service_role;

commit;
