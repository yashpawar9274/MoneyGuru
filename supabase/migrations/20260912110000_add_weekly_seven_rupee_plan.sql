-- Add the ₹7 / 7-day paid plan without changing existing subscriptions.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_plan_check CHECK (plan IN ('weekly', 'pro', 'lifetime'));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'weekly', 'pro', 'lifetime'));

CREATE OR REPLACE FUNCTION public.apply_paid_order(p_order_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  access_interval interval;
BEGIN
  SELECT * INTO p FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF p.provider <> 'payu' THEN RAISE EXCEPTION 'invalid payment provider'; END IF;
  IF p.plan NOT IN ('weekly', 'pro', 'lifetime') THEN RAISE EXCEPTION 'invalid plan'; END IF;
  IF p.amount_inr <> CASE p.plan WHEN 'weekly' THEN 7 WHEN 'pro' THEN 100 ELSE 999 END
    THEN RAISE EXCEPTION 'invalid payment amount';
  END IF;

  IF p.plan = 'lifetime' THEN
    INSERT INTO public.subscriptions (user_id, plan, status, price_inr, current_period_end, trial_ends_at)
    VALUES (p.user_id, 'lifetime', 'active', 0, NULL, NULL)
    ON CONFLICT (user_id) DO UPDATE SET plan='lifetime', status='active', price_inr=0,
      current_period_end=NULL, trial_ends_at=NULL, updated_at=now();
  ELSE
    access_interval := CASE WHEN p.plan = 'weekly' THEN interval '7 days' ELSE interval '30 days' END;
    INSERT INTO public.subscriptions (user_id, plan, status, price_inr, current_period_end, trial_ends_at)
    VALUES (p.user_id, p.plan, 'active', p.amount_inr, now() + access_interval, NULL)
    ON CONFLICT (user_id) DO UPDATE SET
      plan = CASE
        WHEN public.subscriptions.plan = 'lifetime' THEN 'lifetime'
        WHEN p.plan = 'pro' THEN 'pro'
        WHEN public.subscriptions.plan = 'pro' AND public.subscriptions.current_period_end > now() THEN 'pro'
        ELSE 'weekly'
      END,
      status = 'active',
      price_inr = CASE WHEN public.subscriptions.plan = 'lifetime' THEN 0 ELSE p.amount_inr END,
      current_period_end = CASE
        WHEN public.subscriptions.plan = 'lifetime' THEN NULL
        WHEN p.status <> 'paid' AND public.subscriptions.current_period_end > now()
          THEN public.subscriptions.current_period_end + access_interval
        WHEN public.subscriptions.current_period_end > now() THEN public.subscriptions.current_period_end
        ELSE now() + access_interval
      END,
      trial_ends_at = NULL,
      updated_at = now();
  END IF;

  UPDATE public.payments SET status='paid', updated_at=now() WHERE order_id=p_order_id;
  RETURN p.plan;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_paid_order(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_order(text) TO service_role;
