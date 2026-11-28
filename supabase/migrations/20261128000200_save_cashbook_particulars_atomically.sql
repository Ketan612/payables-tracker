create or replace function public.save_cashbook_particulars(
  p_user_id uuid,
  p_movement_id uuid,
  p_particulars text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current text;
  v_movement_id uuid;
begin
  if p_user_id is null or p_movement_id is null then
    return jsonb_build_object('ok', false, 'error', 'user_id and movement_id are required');
  end if;
  if p_particulars is null or char_length(btrim(regexp_replace(p_particulars, '\s+', ' ', 'g'))) < 2
     or char_length(btrim(regexp_replace(p_particulars, '\s+', ' ', 'g'))) > 80
     or lower(btrim(p_particulars)) in ('other', 'skip for now') then
    return jsonb_build_object('ok', false, 'error', 'Enter a description between 2 and 80 characters');
  end if;
  select id, particulars into v_movement_id, v_current
  from public.cash_movements
  where id = p_movement_id and user_id = p_user_id
  for update;
  if v_movement_id is null then
    return jsonb_build_object('ok', false, 'error', 'Cash Book transaction not found');
  end if;
  if nullif(btrim(v_current), '') is not null then
    return jsonb_build_object('ok', false, 'already_saved', true, 'error', 'Particulars already exist; existing value preserved');
  end if;
  update public.cash_movements
  set particulars = btrim(regexp_replace(p_particulars, '\s+', ' ', 'g')),
      particulars_source = 'manual',
      particulars_reviewed_at = now(),
      updated_at = now()
  where id = p_movement_id and user_id = p_user_id
    and nullif(btrim(particulars), '') is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Transaction changed; refresh and retry');
  end if;
  update public.sms_capture_inbox
  set user_particulars = btrim(regexp_replace(p_particulars, '\s+', ' ', 'g'))
  where user_id = p_user_id and movement_id = p_movement_id
    and status = 'posted' and nullif(btrim(user_particulars), '') is null;
  return jsonb_build_object('ok', true, 'movement_id', p_movement_id);
end;
$$;
revoke all on function public.save_cashbook_particulars(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.save_cashbook_particulars(uuid, uuid, text) to service_role;
