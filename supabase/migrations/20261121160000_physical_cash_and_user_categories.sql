-- Physical Cash account and user-managed expense categories.
-- Cash remains a payment method; the linked account is maintained automatically.

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 40),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists expense_categories_user_name_ci_uq
  on public.expense_categories (user_id, lower(trim(name)));

alter table public.expense_categories enable row level security;
drop policy if exists expense_categories_select_own on public.expense_categories;
drop policy if exists expense_categories_insert_own on public.expense_categories;
create policy expense_categories_select_own
  on public.expense_categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy expense_categories_insert_own
  on public.expense_categories for insert to authenticated
  with check ((select auth.uid()) = user_id and is_default = false);
revoke all on public.expense_categories from anon;
revoke update, delete on public.expense_categories from authenticated;
grant select, insert on public.expense_categories to authenticated;

create unique index if not exists bank_accounts_physical_cash_per_user_uq
  on public.bank_accounts (user_id)
  where account_type = 'cash' and lower(trim(account_name)) = 'physical cash';

create or replace function public.ensure_physical_cash_account(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_account_id uuid;
begin
  if p_user_id is null then
    raise exception 'User is required to create a Physical Cash account';
  end if;

  select id into v_account_id
  from public.bank_accounts
  where user_id = p_user_id
    and account_type = 'cash'
    and lower(trim(account_name)) = 'physical cash'
    and is_active = true
  limit 1
  for update;

  if v_account_id is null then
    insert into public.bank_accounts (
      user_id, account_name, institution_name, account_type, notes, is_active
    ) values (
      p_user_id, 'Physical Cash', 'Cash', 'cash',
      'System-managed physical cash account', true
    )
    on conflict do nothing;

    select id into v_account_id
    from public.bank_accounts
    where user_id = p_user_id
      and account_type = 'cash'
      and lower(trim(account_name)) = 'physical cash'
    limit 1;
  end if;

  if v_account_id is null then
    raise exception 'Unable to create or locate the Physical Cash account';
  end if;

  update public.bank_accounts
  set is_active = true, updated_at = now()
  where id = v_account_id and user_id = p_user_id and is_active = false;

  return v_account_id;
end;
$function$;
revoke all on function public.ensure_physical_cash_account(uuid) from public, anon, authenticated;

-- Backfill one Physical Cash account and the existing default categories for every user.
insert into public.bank_accounts (
  user_id, account_name, institution_name, account_type, notes, is_active
)
select u.id, 'Physical Cash', 'Cash', 'cash', 'System-managed physical cash account', true
from auth.users u
where not exists (
  select 1 from public.bank_accounts a
  where a.user_id = u.id and a.account_type = 'cash'
    and lower(trim(a.account_name)) = 'physical cash'
)
on conflict do nothing;

update public.bank_accounts
set is_active = true, updated_at = now()
where account_type = 'cash' and lower(trim(account_name)) = 'physical cash' and not is_active;

insert into public.expense_categories (user_id, name, is_default)
select u.id, c.name, true
from auth.users u
cross join (values
  ('Other'), ('Loan / EMI'), ('Credit card'), ('Shopping'),
  ('Subscription'), ('Food'), ('Fuel')
) as c(name)
on conflict do nothing;

-- Link previously recorded cash sources to the dedicated account.
update public.transactions t
set payment_account_id = a.id, updated_at = now()
from public.bank_accounts a
where a.user_id = t.user_id
  and a.account_type = 'cash'
  and lower(trim(a.account_name)) = 'physical cash'
  and t.payment_method = 'cash'
  and t.payment_account_id is null;

update public.card_payments p
set payment_account_id = a.id
from public.bank_accounts a
where a.user_id = p.user_id
  and a.account_type = 'cash'
  and lower(trim(a.account_name)) = 'physical cash'
  and p.payment_method = 'cash'
  and p.payment_account_id is null;

update public.card_bill_payments p
set payment_account_id = a.id
from public.bank_accounts a
where a.user_id = p.user_id
  and a.account_type = 'cash'
  and lower(trim(a.account_name)) = 'physical cash'
  and p.payment_method = 'cash'
  and p.payment_account_id is null;

update public.settlement_batches b
set account_id = a.id
from public.bank_accounts a
where a.user_id = b.user_id
  and a.account_type = 'cash'
  and lower(trim(a.account_name)) = 'physical cash'
  and b.payment_method = 'cash'
  and b.account_id is null;

update public.settlements s
set account_id = b.account_id
from public.settlement_batches b
where b.id = s.settlement_batch_id
  and b.user_id = s.user_id
  and b.payment_method = 'cash'
  and b.account_id is not null
  and s.account_id is null;

update public.cash_movements cm
set account_id = b.account_id
from public.settlement_batches b
where cm.settlement_batch_id = b.id
  and cm.user_id = b.user_id
  and b.payment_method = 'cash'
  and b.account_id is not null
  and cm.account_id is null;

-- The old card-payment RPC stored a deterministic fallback note. Only link those
-- movements where the payment ID is explicitly present; custom notes remain untouched.
update public.cash_movements cm
set account_id = p.payment_account_id
from public.card_payments p
where p.user_id = cm.user_id
  and p.payment_method = 'cash'
  and p.payment_account_id is not null
  and cm.account_id is null
  and cm.reference_note = 'Card payment ' || p.id::text;

-- Existing cash-paid expenses had no Cash Book movement. Link each by transaction ID
-- so that future edits/audits can identify the source and avoid duplicate postings.
insert into public.cash_movements (
  user_id, account_id, movement_date, direction, amount,
  movement_type, transaction_id, description
)
select
  t.user_id, t.payment_account_id, t.transaction_date, 'out', t.amount,
  'other', t.id, 'Expense - ' || t.title
from public.transactions t
where t.payment_method = 'cash'
  and t.transaction_kind in ('expense', 'shared_expense')
  and t.status <> 'cancelled'
  and t.payment_account_id is not null
  and not exists (
    select 1 from public.cash_movements cm
    where cm.transaction_id = t.id and cm.user_id = t.user_id
  );

-- New users receive the same starter data automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));

  perform public.ensure_physical_cash_account(new.id);

  insert into public.expense_categories (user_id, name, is_default)
  select new.id, c.name, true
  from (values
    ('Other'), ('Loan / EMI'), ('Credit card'), ('Shopping'),
    ('Subscription'), ('Food'), ('Fuel')
  ) as c(name)
  on conflict do nothing;

  return new;
end;
$function$;

-- Cash is an account-backed source for paid expenses; Wallet and Unpaid remain accountless.
do $migration$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.create_expense_v1(text,numeric,date,text,text,text,text,uuid,uuid,boolean,numeric,text,uuid,uuid,uuid,date,text)'::regprocedure);
  v_new := replace(v_def,
    '    -- Validate payment source.',
    '    IF p_payment_method = ''cash'' THEN' || chr(10) ||
    '        p_payment_account_id := public.ensure_physical_cash_account(v_user_id);' || chr(10) ||
    '    END IF;' || chr(10) || chr(10) ||
    '    -- Validate payment source.');
  v_new := replace(v_new,
    '    RETURNING id INTO v_transaction_id;' || chr(10) || chr(10) ||
    '    -- Create the linked payable only when required.',
    '    RETURNING id INTO v_transaction_id;' || chr(10) || chr(10) ||
    '    IF p_payment_method = ''cash'' THEN' || chr(10) ||
    '        INSERT INTO public.cash_movements (' || chr(10) ||
    '            user_id, account_id, movement_date, direction, amount, movement_type, transaction_id, description' || chr(10) ||
    '        ) VALUES (' || chr(10) ||
    '            v_user_id, p_payment_account_id, p_transaction_date, ''out'', p_amount, ''other'', v_transaction_id, ''Expense - '' || trim(p_title)' || chr(10) ||
    '        );' || chr(10) ||
    '    END IF;' || chr(10) || chr(10) ||
    '    -- Create the linked payable only when required.');
  if v_new = v_def then raise exception 'Could not patch create_expense_v1'; end if;
  execute v_new;

  v_def := pg_get_functiondef('public.create_shared_expense_v2(text,numeric,date,text,text,jsonb,text,uuid,uuid,boolean,numeric,text,uuid,uuid,uuid,date,text)'::regprocedure);
  v_new := replace(v_def,
    '    -- Validate payment source.',
    '    IF p_payment_method = ''cash'' THEN' || chr(10) ||
    '        p_payment_account_id := public.ensure_physical_cash_account(v_user_id);' || chr(10) ||
    '    END IF;' || chr(10) || chr(10) ||
    '    -- Validate payment source.');
  v_new := replace(v_new,
    '    ELSIF p_payment_method IN (''cash'', ''wallet'', ''unpaid'') THEN' || chr(10) || chr(10) ||
    '        IF p_payment_account_id IS NOT NULL' || chr(10) ||
    '           OR p_payment_card_id IS NOT NULL THEN' || chr(10) ||
    '            RAISE EXCEPTION ''This payment method cannot have a linked account or card'';' || chr(10) ||
    '        END IF;',
    '    ELSIF p_payment_method = ''cash'' THEN' || chr(10) || chr(10) ||
    '        IF p_payment_account_id IS NULL OR p_payment_card_id IS NOT NULL THEN' || chr(10) ||
    '            RAISE EXCEPTION ''Select the Physical Cash account'';' || chr(10) ||
    '        END IF;' || chr(10) ||
    '        PERFORM 1 FROM public.bank_accounts' || chr(10) ||
    '        WHERE id = p_payment_account_id AND user_id = v_user_id' || chr(10) ||
    '          AND is_active = true AND account_type = ''cash'';' || chr(10) ||
    '        IF NOT FOUND THEN RAISE EXCEPTION ''Physical Cash account is invalid or inactive''; END IF;' || chr(10) ||
    '    ELSIF p_payment_method IN (''wallet'', ''unpaid'') THEN' || chr(10) || chr(10) ||
    '        IF p_payment_account_id IS NOT NULL OR p_payment_card_id IS NOT NULL THEN' || chr(10) ||
    '            RAISE EXCEPTION ''This payment method cannot have a linked account or card'';' || chr(10) ||
    '        END IF;');
  v_new := replace(v_new,
    '    RETURNING id INTO v_transaction_id;' || chr(10) || chr(10) ||
    '    -- Save participant allocations.',
    '    RETURNING id INTO v_transaction_id;' || chr(10) || chr(10) ||
    '    IF p_payment_method = ''cash'' THEN' || chr(10) ||
    '        INSERT INTO public.cash_movements (' || chr(10) ||
    '            user_id, account_id, movement_date, direction, amount, movement_type, transaction_id, description' || chr(10) ||
    '        ) VALUES (' || chr(10) ||
    '            v_user_id, p_payment_account_id, p_transaction_date, ''out'', p_amount, ''other'', v_transaction_id, ''Expense - '' || trim(p_title)' || chr(10) ||
    '        );' || chr(10) ||
    '    END IF;' || chr(10) || chr(10) ||
    '    -- Save participant allocations.');
  if v_new = v_def then raise exception 'Could not patch create_shared_expense_v2'; end if;
  execute v_new;

  v_def := pg_get_functiondef('public.record_card_payment(uuid,numeric,date,text,uuid,jsonb,text)'::regprocedure);
  v_new := replace(v_def,
    '  if p_payment_method = ''bank'' then',
    '  if p_payment_method = ''cash'' then' || chr(10) ||
    '    p_payment_account_id := public.ensure_physical_cash_account(v_user_id);' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if p_payment_method = ''bank'' then');
  v_new := replace(v_new,
    '  elsif p_payment_account_id is not null then' || chr(10) ||
    '    raise exception ''Only bank payments can reference a bank account'';',
    '  elsif p_payment_method = ''cash'' then' || chr(10) ||
    '    if p_payment_account_id is null then raise exception ''Select the Physical Cash account''; end if;' || chr(10) ||
    '    perform 1 from public.bank_accounts where id = p_payment_account_id and user_id = v_user_id and is_active = true and account_type = ''cash'';' || chr(10) ||
    '    if not found then raise exception ''Physical Cash account is invalid or inactive''; end if;' || chr(10) ||
    '  elsif p_payment_account_id is not null then' || chr(10) ||
    '    raise exception ''Only bank and cash payments can reference an account'';');
  if v_new = v_def then raise exception 'Could not patch record_card_payment'; end if;
  execute v_new;

  v_def := pg_get_functiondef('public.record_card_bill_payment(uuid,date,numeric,date,text,uuid,text)'::regprocedure);
  v_new := replace(v_def,
    '  if p_payment_method=''bank'' then',
    '  if p_payment_method=''cash'' then' || chr(10) ||
    '    p_payment_account_id := public.ensure_physical_cash_account(v_user_id);' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if p_payment_method=''bank'' then');
  v_new := replace(v_new,
    '  elsif p_payment_account_id is not null then' || chr(10) ||
    '    raise exception ''Only bank payments can reference a bank account'';',
    '  elsif p_payment_method=''cash'' then' || chr(10) ||
    '    if p_payment_account_id is null then raise exception ''Select the Physical Cash account''; end if;' || chr(10) ||
    '    perform 1 from public.bank_accounts where id=p_payment_account_id and user_id=v_user_id and is_active=true and account_type=''cash'';' || chr(10) ||
    '    if not found then raise exception ''Physical Cash account is invalid or inactive''; end if;' || chr(10) ||
    '  elsif p_payment_account_id is not null then' || chr(10) ||
    '    raise exception ''Only bank and cash payments can reference an account'';');
  v_new := replace(v_new,
    '  values(v_user_id,p_payment_card_id,p_billing_cycle_start,p_amount,p_payment_date,p_payment_method,p_payment_account_id,nullif(trim(p_reference_note),'''')) returning id into v_payment_id;',
    '  values(v_user_id,p_payment_card_id,p_billing_cycle_start,p_amount,p_payment_date,p_payment_method,p_payment_account_id,nullif(trim(p_reference_note),'''')) returning id into v_payment_id;' || chr(10) ||
    '  if p_payment_method=''cash'' then' || chr(10) ||
    '    insert into public.cash_movements(user_id,account_id,movement_date,direction,amount,movement_type,description,reference_note)' || chr(10) ||
    '    values(v_user_id,p_payment_account_id,p_payment_date,''out'',p_amount,''settlement_paid'',''Credit card bill payment - ''||(select card_name from public.payment_cards where id=p_payment_card_id and user_id=v_user_id),coalesce(nullif(trim(p_reference_note),''''),''Card bill payment ''||v_payment_id::text));' || chr(10) ||
    '  end if;');
  if v_new = v_def then raise exception 'Could not patch record_card_bill_payment'; end if;
  execute v_new;

  v_def := pg_get_functiondef('public.record_person_settlement(uuid,text,numeric,date,text,uuid,jsonb,text)'::regprocedure);
  v_new := replace(v_def,
    '    -- Bank account is mandatory.',
    '    IF p_payment_method = ''cash'' THEN' || chr(10) ||
    '        p_account_id := public.ensure_physical_cash_account(v_user_id);' || chr(10) ||
    '    END IF;' || chr(10) || chr(10) ||
    '    -- Bank account is mandatory.');
  if v_new = v_def then raise exception 'Could not patch record_person_settlement'; end if;
  execute v_new;
end;
$migration$;
