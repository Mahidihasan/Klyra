-- 2026_09_05_001_billing_realtime.sql
-- ============================================================================
-- Billing realtime notifications (SSE via Postgres LISTEN/NOTIFY).
--
-- When any of the billing tables that show up on the Billing dashboard change,
-- we push a NOTIFY so the backend's SSE hub can immediately tell the affected
-- user's open pages to refresh. The hub LISTENs on the 'billing_change'
-- channel and forwards the payload to matching subscribers.
--
-- The trigger routes the notification by user_id so a change only wakes the
-- page(s) of the account it belongs to.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_billing_change()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_payload TEXT;
BEGIN
    -- NEW on INSERT/UPDATE, OLD on DELETE.
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
    IF v_user_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_payload := json_build_object(
        'userId', v_user_id::text,
        'table',  TG_TABLE_NAME,
        'event',  TG_OP,
        'at',     clock_timestamp()
    )::text;

    PERFORM pg_notify('billing_change', v_payload);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Invoices: a subscription being raised, paid, overdue or voided.
DROP TRIGGER IF EXISTS trg_billing_change_invoices ON invoices;
CREATE TRIGGER trg_billing_change_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION notify_billing_change();

-- Payments: any attempt (succeeded, pending or failed) hitting an invoice.
DROP TRIGGER IF EXISTS trg_billing_change_payments ON payments;
CREATE TRIGGER trg_billing_change_payments
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION notify_billing_change();