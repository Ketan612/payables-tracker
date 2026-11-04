
BEGIN;

-- =========================================================
-- 1. Add a traceable link to the original legacy settlement
-- =========================================================

ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS legacy_transaction_settlement_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS transaction_settlements_id_user_uidx
ON public.transaction_settlements (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS settlements_legacy_transaction_settlement_uidx
ON public.settlements (legacy_transaction_settlement_id)
WHERE legacy_transaction_settlement_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'settlements_legacy_transaction_settlement_fk'
          AND conrelid = 'public.settlements'::regclass
    ) THEN
        ALTER TABLE public.settlements
        ADD CONSTRAINT settlements_legacy_transaction_settlement_fk
        FOREIGN KEY (legacy_transaction_settlement_id, user_id)
        REFERENCES public.transaction_settlements (id, user_id)
        ON DELETE RESTRICT;
    END IF;
END;
$$;


-- =========================================================
-- 2. Correct settlement-to-split synchronization trigger
-- =========================================================

CREATE OR REPLACE FUNCTION public.sync_transaction_split_amount_settled()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    v_old_split uuid;
    v_old_user uuid;
    v_new_split uuid;
    v_new_user uuid;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        v_old_split := OLD.split_id;
        v_old_user := OLD.user_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        v_new_split := NEW.split_id;
        v_new_user := NEW.user_id;
    END IF;

    -- Recalculate the old split if removed or reassigned.
    IF v_old_split IS NOT NULL
       AND (
           TG_OP = 'DELETE'
           OR v_old_split IS DISTINCT FROM v_new_split
           OR v_old_user IS DISTINCT FROM v_new_user
       )
    THEN
        UPDATE public.transaction_splits sp
        SET amount_settled = COALESCE((
            SELECT SUM(s.amount)
            FROM public.settlements s
            WHERE s.split_id = v_old_split
              AND s.user_id = v_old_user
        ), 0)
        WHERE sp.id = v_old_split
          AND sp.user_id = v_old_user;
    END IF;

    -- Always recalculate the new split, including same-split
    -- updates where only the settlement amount changed.
    IF v_new_split IS NOT NULL THEN
        UPDATE public.transaction_splits sp
        SET amount_settled = COALESCE((
            SELECT SUM(s.amount)
            FROM public.settlements s
            WHERE s.split_id = v_new_split
              AND s.user_id = v_new_user
        ), 0)
        WHERE sp.id = v_new_split
          AND sp.user_id = v_new_user;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$;


-- =========================================================
-- 3. Validate the exact historical backfill before changing
--    any settlement data.
-- =========================================================

DO $$
DECLARE
    v_user_id uuid := 'd1b11999-207d-4918-ba6b-4d2b0158cebf';
    v_valid_count integer;
    v_receivable_count integer;
    v_existing_ledger_count integer;
BEGIN
    WITH expected (
        legacy_id,
        transaction_id,
        split_id,
        person_id,
        amount,
        settlement_date
    ) AS (
        VALUES
        (
            '2907f236-3c97-4e09-ae71-1be38514c62e'::uuid,
            '418dbd14-9b5d-496e-9465-c2afe295212b'::uuid,
            '00bf17ca-8ff4-4c90-a5d3-2030aafa6676'::uuid,
            '3dcfdbbe-4921-4838-b80d-8d2b72842367'::uuid,
            1000::numeric,
            DATE '2026-11-04'
        ),
        (
            '116c00f7-cdb0-4da0-975c-735e4fd062b6'::uuid,
            '418dbd14-9b5d-496e-9465-c2afe295212b'::uuid,
            '00bf17ca-8ff4-4c90-a5d3-2030aafa6676'::uuid,
            '3dcfdbbe-4921-4838-b80d-8d2b72842367'::uuid,
            800::numeric,
            DATE '2026-11-04'
        ),
        (
            '355d8076-3459-4d47-a86b-cafc935290f4'::uuid,
            '418dbd14-9b5d-496e-9465-c2afe295212b'::uuid,
            '8c67b99a-290e-4863-afb8-f3608b9bb4bf'::uuid,
            'e989eec9-6343-418c-8c57-1b1a0dca8ede'::uuid,
            2200::numeric,
            DATE '2026-11-04'
        ),
        (
            'bd04d889-d0f9-48b9-9ac5-13e7b2d00786'::uuid,
            '2b85197c-8a06-4c8c-a851-abce745d9de5'::uuid,
            'b96598c6-1ad4-4cde-83cd-05f871c36774'::uuid,
            '3dcfdbbe-4921-4838-b80d-8d2b72842367'::uuid,
            1800::numeric,
            DATE '2026-11-04'
        ),
        (
            'd207e46d-9025-4b8d-9efe-6f4214edd597'::uuid,
            '2b85197c-8a06-4c8c-a851-abce745d9de5'::uuid,
            '3770a90e-b226-4514-b593-3a7631e48bb7'::uuid,
            'e989eec9-6343-418c-8c57-1b1a0dca8ede'::uuid,
            2200::numeric,
            DATE '2026-11-04'
        ),
        (
            '65ba2e8b-ee53-4121-ac13-8445a9d476f2'::uuid,
            '8c800c4e-ed22-4ba9-9f1f-8f0e82f12987'::uuid,
            'be9a8137-3390-43e5-936a-63f58b477003'::uuid,
            '3dcfdbbe-4921-4838-b80d-8d2b72842367'::uuid,
            1000::numeric,
            DATE '2026-11-04'
        )
    )
    SELECT COUNT(*)
    INTO v_valid_count
    FROM expected e
    JOIN public.transaction_settlements ts
      ON ts.id = e.legacy_id
     AND ts.user_id = v_user_id
     AND ts.transaction_id = e.transaction_id
     AND ts.split_id = e.split_id
     AND ts.settlement_type = 'receivable'
     AND ts.amount = e.amount
     AND ts.settlement_date = e.settlement_date
     AND ts.is_opening_balance = false
     AND ts.payable_transaction_id IS NULL
    JOIN public.transaction_splits sp
      ON sp.id = e.split_id
     AND sp.user_id = v_user_id
     AND sp.transaction_id = e.transaction_id
     AND sp.person_id = e.person_id;

    IF v_valid_count <> 6 THEN
        RAISE EXCEPTION
            'Backfill validation failed: expected 6 exact historical records, found %',
            v_valid_count;
    END IF;

    SELECT COUNT(*)
    INTO v_receivable_count
    FROM public.transaction_settlements
    WHERE user_id = v_user_id
      AND settlement_type = 'receivable';

    IF v_receivable_count <> 6 THEN
        RAISE EXCEPTION
            'Expected exactly 6 legacy receivables for this user, found %',
            v_receivable_count;
    END IF;

    SELECT COUNT(*)
    INTO v_existing_ledger_count
    FROM public.settlements
    WHERE user_id = v_user_id
      AND split_id IN (
          '00bf17ca-8ff4-4c90-a5d3-2030aafa6676'::uuid,
          '8c67b99a-290e-4863-afb8-f3608b9bb4bf'::uuid,
          'b96598c6-1ad4-4cde-83cd-05f871c36774'::uuid,
          '3770a90e-b226-4514-b593-3a7631e48bb7'::uuid,
          'be9a8137-3390-43e5-936a-63f58b477003'::uuid
      );

    IF v_existing_ledger_count <> 0 THEN
        RAISE EXCEPTION
            'Backfill stopped: found % existing ledger rows on audited splits',
            v_existing_ledger_count;
    END IF;
END;
$$;


-- =========================================================
-- 4. Backfill only the six historical participant receipts
--    No settlement batches or cash movements are created.
-- =========================================================

INSERT INTO public.settlements (
    user_id,
    transaction_id,
    split_id,
    person_id,
    amount,
    settlement_date,
    direction,
    payment_method,
    account_id,
    reference_note,
    legacy_transaction_settlement_id,
    created_at
)
SELECT
    ts.user_id,
    ts.transaction_id,
    ts.split_id,
    sp.person_id,
    ts.amount,
    ts.settlement_date,
    'received_by_user',
    NULL,
    NULL,
    ts.notes,
    ts.id,
    ts.created_at
FROM public.transaction_settlements ts
JOIN public.transaction_splits sp
  ON sp.id = ts.split_id
 AND sp.user_id = ts.user_id
WHERE ts.user_id = 'd1b11999-207d-4918-ba6b-4d2b0158cebf'
  AND ts.id IN (
      '2907f236-3c97-4e09-ae71-1be38514c62e'::uuid,
      '116c00f7-cdb0-4da0-975c-735e4fd062b6'::uuid,
      '355d8076-3459-4d47-a86b-cafc935290f4'::uuid,
      'bd04d889-d0f9-48b9-9ac5-13e7b2d00786'::uuid,
      'd207e46d-9025-4b8d-9efe-6f4214edd597'::uuid,
      '65ba2e8b-ee53-4121-ac13-8445a9d476f2'::uuid
  )
  AND ts.settlement_type = 'receivable'
  AND ts.is_opening_balance = false
  AND ts.payable_transaction_id IS NULL
ON CONFLICT DO NOTHING;


-- =========================================================
-- 5. Verify ledger totals and split balances after backfill
-- =========================================================

DO $$
DECLARE
    v_user_id uuid := 'd1b11999-207d-4918-ba6b-4d2b0158cebf';
    v_mismatch_count integer;
    v_backfilled_count integer;
BEGIN
    SELECT COUNT(*)
    INTO v_backfilled_count
    FROM public.settlements
    WHERE user_id = v_user_id
      AND legacy_transaction_settlement_id IN (
          '2907f236-3c97-4e09-ae71-1be38514c62e'::uuid,
          '116c00f7-cdb0-4da0-975c-735e4fd062b6'::uuid,
          '355d8076-3459-4d47-a86b-cafc935290f4'::uuid,
          'bd04d889-d0f9-48b9-9ac5-13e7b2d00786'::uuid,
          'd207e46d-9025-4b8d-9efe-6f4214edd597'::uuid,
          '65ba2e8b-ee53-4121-ac13-8445a9d476f2'::uuid
      );

    IF v_backfilled_count <> 6 THEN
        RAISE EXCEPTION
            'Backfill verification failed: expected 6 ledger rows, found %',
            v_backfilled_count;
    END IF;

    WITH expected (split_id, expected_amount) AS (
        VALUES
        ('00bf17ca-8ff4-4c90-a5d3-2030aafa6676'::uuid, 1800::numeric),
        ('8c67b99a-290e-4863-afb8-f3608b9bb4bf'::uuid, 2200::numeric),
        ('b96598c6-1ad4-4cde-83cd-05f871c36774'::uuid, 1800::numeric),
        ('3770a90e-b226-4514-b593-3a7631e48bb7'::uuid, 2200::numeric),
        ('be9a8137-3390-43e5-936a-63f58b477003'::uuid, 1000::numeric)
    ),
    actual AS (
        SELECT
            e.split_id,
            e.expected_amount,
            sp.amount_settled,
            COALESCE(SUM(s.amount), 0) AS ledger_amount
        FROM expected e
        JOIN public.transaction_splits sp
          ON sp.id = e.split_id
         AND sp.user_id = v_user_id
        LEFT JOIN public.settlements s
          ON s.split_id = e.split_id
         AND s.user_id = v_user_id
        GROUP BY e.split_id, e.expected_amount, sp.amount_settled
    )
    SELECT COUNT(*)
    INTO v_mismatch_count
    FROM actual
    WHERE ledger_amount <> expected_amount
       OR amount_settled <> expected_amount;

    IF v_mismatch_count <> 0 THEN
        RAISE EXCEPTION
            'Split reconciliation failed for % audited splits',
            v_mismatch_count;
    END IF;
END;
$$;


-- =========================================================
-- 6. Retire the old participant settlement RPCs.
--    The frontend now uses record_person_settlement().
-- =========================================================

REVOKE ALL ON FUNCTION public.record_receivable_settlement(
    uuid, numeric, date, text
) FROM PUBLIC, authenticated;

REVOKE ALL ON FUNCTION public.record_participant_payable_settlement(
    uuid, numeric, date, text
) FROM PUBLIC, authenticated;


COMMIT;
