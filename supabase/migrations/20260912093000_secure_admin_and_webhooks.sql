-- MoneyGuruAI secure admin bootstrap and callback storage hardening.
-- Privileged writes remain service-role only; authenticated users can only read
-- admin feeds when has_role(auth.uid(), 'admin') is true.

REVOKE INSERT, UPDATE, DELETE ON public.webhook_logs FROM anon, authenticated;
GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;

DROP POLICY IF EXISTS "admins read webhook logs" ON public.webhook_logs;
CREATE POLICY "admins read webhook logs" ON public.webhook_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all payments" ON public.payments;
CREATE POLICY "admins read all payments" ON public.payments
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all subscriptions" ON public.subscriptions;
CREATE POLICY "admins read all subscriptions" ON public.subscriptions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'theyashpawar92@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Avoid duplicate publication failures while keeping live admin refresh events.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
