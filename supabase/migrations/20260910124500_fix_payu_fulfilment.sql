-- MoneyGuruAI: idempotent PayU payment fulfilment.
-- Run this in Supabase SQL Editor if migrations are not applied automatically.
CREATE OR REPLACE FUNCTION public.apply_paid_order(p_order_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
BEGIN
  SELECT * INTO p
  FROM public.payments
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF p.provider <> 'payu' THEN
    RAISE EXCEPTION 'invalid payment provider';
  END IF;

  IF p.plan NOT IN ('pro', 'lifetime') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;

  -- Always ensure the subscription exists even when a previous callback already
  -- marked the payment paid. This makes fulfilment safe to retry.
  IF p.plan = 'lifetime' THEN
    INSERT INTO public.subscriptions
      (user_id, plan, status, price_inr, current_period_end, trial_ends_at)
    VALUES
      (p.user_id, 'lifetime', 'active', 0, NULL, NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      plan = 'lifetime',
      status = 'active',
      price_inr = 0,
      current_period_end = NULL,
      trial_ends_at = NULL,
      updated_at = now();
  ELSE
    INSERT INTO public.subscriptions
      (user_id, plan, status, price_inr, current_period_end, trial_ends_at)
    VALUES
      (p.user_id, 'pro', 'active', 100, now() + interval '30 days', NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      plan = CASE WHEN public.subscriptions.plan = 'lifetime' THEN 'lifetime' ELSE 'pro' END,
      status = 'active',
      price_inr = CASE WHEN public.subscriptions.plan = 'lifetime' THEN 0 ELSE 100 END,
      current_period_end = CASE
        WHEN public.subscriptions.plan = 'lifetime' THEN NULL
        -- Only extend an existing Pro period the first time this order is fulfilled.
        WHEN p.status <> 'paid' AND public.subscriptions.plan = 'pro'
             AND public.subscriptions.current_period_end > now()
          THEN public.subscriptions.current_period_end + interval '30 days'
        WHEN public.subscriptions.plan = 'pro' AND public.subscriptions.current_period_end > now()
          THEN public.subscriptions.current_period_end
        ELSE now() + interval '30 days'
      END,
      trial_ends_at = NULL,
      updated_at = now();
  END IF;

  UPDATE public.payments
  SET status = 'paid', updated_at = now()
  WHERE order_id = p_order_id;

  RETURN p.plan;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_paid_order(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_order(text) TO service_role;
