
-- Shared expense: allow another registered person to be the payer.
-- Existing v2/v3 functions and existing transaction records remain unchanged.

CREATE OR REPLACE FUNCTION public.create_shared_expense_v4(
    p_title text,
    p_amount numeric,
    p_transaction_date date,
    p_category text,
    p_notes text,
    p_splits jsonb,
    p_payment_method text DEFAULT 'unpaid',
    p_payment_account_id uuid DEFAULT NULL,
    p_payment_card_id uuid DEFAULT NULL,
    p_create_payable boolean DEFAULT false,
    p_payable_amount numeric DEFAULT NULL,
    p_payable_to_type text DEFAULT NULL,
    p_payable_to_person_id uuid DEFAULT NULL,
    p_payable_to_account_id uuid DEFAULT NULL,
    p_payable_to_card_id uuid DEFAULT NULL,
    p_payable_due_date date DEFAULT NULL,
    p_payable_notes text DEFAULT NULL,
    p_payer_person_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid := auth.uid();
    v_transaction_id uuid;
    v_payer_name text;
    v_user_share numeric;
    v_user_share_count integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- No other payer selected: preserve the existing v3 behavior.
    IF p_payer_person_id IS NULL THEN
        v_transaction_id := public.create_shared_expense_v2(
            p_title,
            p_amount,
            p_transaction_date,
            p_category,
            p_notes,
            p_splits,
            p_payment_method,
            p_payment_account_id,
            p_payment_card_id,
            p_create_payable,
            p_payable_amount,
            p_payable_to_type,
            p_payable_to_person_id,
            p_payable_to_account_id,
            p_payable_to_card_id,
            p_payable_due_date,
            p_payable_notes
        );

        UPDATE public.transactions
        SET transaction_kind = 'expense'
        WHERE id = v_transaction_id
          AND user_id = v_user_id;

        RETURN v_transaction_id;
    END IF;

    -- Someone else is paying: manual payable settings must not
    -- create a second, potentially duplicate liability.
    IF COALESCE(p_create_payable, false)
       OR p_payable_amount IS NOT NULL
       OR p_payable_to_type IS NOT NULL
       OR p_payable_to_person_id IS NOT NULL
       OR p_payable_to_account_id IS NOT NULL
       OR p_payable_to_card_id IS NOT NULL
       OR p_payable_due_date IS NOT NULL
       OR p_payable_notes IS NOT NULL THEN
        RAISE EXCEPTION
            'Manual payable settings cannot be combined with someone else as payer';
    END IF;

    IF p_splits IS NULL
       OR jsonb_typeof(p_splits) <> 'array' THEN
        RAISE EXCEPTION 'Invalid participant splits';
    END IF;

    -- Validate that the payer is a registered person belonging
    -- to this user and is included in the participant split.
    SELECT name
    INTO v_payer_name
    FROM public.people
    WHERE id = p_payer_person_id
      AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected payer does not belong to your account';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_splits) s
        WHERE nullif(s->>'person_id', '')::uuid = p_payer_person_id
          AND NOT COALESCE(
              (s->>'is_current_user')::boolean,
              false
          )
    ) THEN
        RAISE EXCEPTION
            'The selected payer must be included in the participant split';
    END IF;

    -- Exactly one current-user share is required.
    SELECT
        COUNT(*),
        MAX((s->>'share_amount')::numeric)
    INTO
        v_user_share_count,
        v_user_share
    FROM jsonb_array_elements(p_splits) s
    WHERE COALESCE(
        (s->>'is_current_user')::boolean,
        false
    );

    IF v_user_share_count <> 1
       OR v_user_share IS NULL
       OR v_user_share <= 0 THEN
        RAISE EXCEPTION 'A valid current-user share is required';
    END IF;

    -- Reuse v2's complete validation and master/split creation.
    -- Cash is used internally so no user-owned account or card
    -- is incorrectly recorded as the funding source.
    v_transaction_id := public.create_shared_expense_v2(
        p_title,
        p_amount,
        p_transaction_date,
        p_category,
        p_notes,
        p_splits,
        'cash',
        NULL,
        NULL,
        false,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
    );

    -- Mark the master as paid by the selected person.
    UPDATE public.transactions
    SET transaction_kind = 'expense',
        payer_type = 'person',
        counterparty_person_id = p_payer_person_id,
        payment_method = 'other',
        payment_account_id = NULL,
        payment_card_id = NULL
    WHERE id = v_transaction_id
      AND user_id = v_user_id;

    -- These splits are informational. The linked payable below
    -- represents the user's share, so no split balance is created.
    UPDATE public.transaction_splits
    SET balance_direction = 'no_balance'
    WHERE transaction_id = v_transaction_id
      AND user_id = v_user_id;

    -- Create exactly one payable: the current user's share only.
    INSERT INTO public.transactions (
        user_id,
        title,
        amount,
        currency_code,
        transaction_date,
        transaction_kind,
        category,
        expense_scope,
        expense_context,
        payer_type,
        payment_method,
        status,
        accounting_cycle,
        related_transaction_id,
        payable_to_type,
        payable_to_person_id,
        notes
    )
    SELECT
        v_user_id,
        'Payable - ' || trim(p_title),
        v_user_share,
        'INR',
        p_transaction_date,
        'payable',
        coalesce(nullif(trim(p_category), ''), 'Other'),
        'common',
        'shared',
        'unpaid',
        'unpaid',
        'pending',
        date_trunc('month', p_transaction_date)::date,
        v_transaction_id,
        'person',
        p_payer_person_id,
        'Your share payable to ' || v_payer_name
    ;

    RETURN v_transaction_id;
END;
$function$;

-- Restrict execution to authenticated users.
REVOKE ALL ON FUNCTION public.create_shared_expense_v4(
    text, numeric, date, text, text, jsonb,
    text, uuid, uuid, boolean, numeric, text,
    uuid, uuid, uuid, date, text, uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_shared_expense_v4(
    text, numeric, date, text, text, jsonb,
    text, uuid, uuid, boolean, numeric, text,
    uuid, uuid, uuid, date, text, uuid
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_shared_expense_v4(
    text, numeric, date, text, text, jsonb,
    text, uuid, uuid, boolean, numeric, text,
    uuid, uuid, uuid, date, text, uuid
) TO authenticated;
