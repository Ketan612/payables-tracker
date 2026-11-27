begin;

alter table public.cash_movements
  add column if not exists particulars_source text not null default 'legacy',
  add column if not exists particulars_confidence numeric(5,4),
  add column if not exists particulars_reviewed_at timestamptz;

alter table public.cash_movements
  add constraint cash_movements_particulars_source_check
  check (particulars_source in ('legacy','manual','learned','automatic','fallback')) not valid;

alter table public.cash_movements
  add constraint cash_movements_particulars_confidence_check
  check (particulars_confidence is null or particulars_confidence between 0 and 1) not valid;

alter table public.cash_movements
  validate constraint cash_movements_particulars_source_check;
alter table public.cash_movements
  validate constraint cash_movements_particulars_confidence_check;

alter table public.cashbook_merchant_particulars
  add column if not exists is_active boolean not null default true,
  add column if not exists confirmed_count integer not null default 0,
  add column if not exists source text not null default 'manual';

alter table public.cashbook_merchant_particulars
  add constraint cashbook_merchant_particulars_source_check
  check (source in ('manual','imported')) not valid;
alter table public.cashbook_merchant_particulars
  validate constraint cashbook_merchant_particulars_source_check;

create index if not exists cashbook_merchant_particulars_active_idx
  on public.cashbook_merchant_particulars(user_id, merchant_key, is_active, confirmed_count desc, last_used_at desc);

commit;
