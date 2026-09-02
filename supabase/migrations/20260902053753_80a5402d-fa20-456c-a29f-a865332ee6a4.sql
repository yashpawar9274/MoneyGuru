CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text NOT NULL UNIQUE,
  plan text NOT NULL CHECK (plan IN ('pro','lifetime')),
  amount_inr numeric NOT NULL,
  status text NOT NULL DEFAULT 'created',
  provider text NOT NULL DEFAULT 'cashfree',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own payments read" ON public.payments;
CREATE POLICY "own payments read" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Fulfilment: called by the server (service role) only, after Cashfree confirms payment.
CREATE OR REPLACE FUNCTION public.apply_paid_order(p_order_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments;
BEGIN
  SELECT * INTO p FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF p.user_id IS NULL THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF p.status = 'paid' THEN
    RETURN p.plan;
  END IF;

  UPDATE public.payments SET status = 'paid', updated_at = now() WHERE order_id = p_order_id;

  IF p.plan = 'lifetime' THEN
    INSERT INTO public.subscriptions (user_id, plan, status, price_inr, current_period_end, trial_ends_at)
    VALUES (p.user_id, 'lifetime', 'active', 0, NULL, NULL)
    ON CONFLICT (user_id) DO UPDATE
      SET plan = 'lifetime', status = 'active', price_inr = 0,
          current_period_end = NULL, updated_at = now();
  ELSE
    INSERT INTO public.subscriptions (user_id, plan, status, price_inr, current_period_end, trial_ends_at)
    VALUES (p.user_id, 'pro', 'active', 100, now() + interval '30 days', NULL)
    ON CONFLICT (user_id) DO UPDATE
      SET plan = CASE WHEN public.subscriptions.plan = 'lifetime' THEN 'lifetime' ELSE 'pro' END,
          status = 'active',
          price_inr = CASE WHEN public.subscriptions.plan = 'lifetime' THEN 0 ELSE 100 END,
          current_period_end = CASE
            WHEN public.subscriptions.plan = 'lifetime' THEN NULL
            WHEN public.subscriptions.current_period_end > now()
              THEN public.subscriptions.current_period_end + interval '30 days'
            ELSE now() + interval '30 days' END,
          updated_at = now();
  END IF;

  RETURN p.plan;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_paid_order(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_order(text) TO service_role;