ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

UPDATE public.subscriptions SET trial_ends_at = created_at + interval '24 hours'
WHERE trial_ends_at IS NULL AND plan = 'free';

CREATE OR REPLACE FUNCTION public.bootstrap_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.profiles (id, email)
  VALUES (uid, mail)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  INSERT INTO public.subscriptions (user_id, plan, price_inr, trial_ends_at)
  VALUES (uid, 'free', 0, now() + interval '24 hours')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.subscriptions
    SET trial_ends_at = coalesce(trial_ends_at, created_at + interval '24 hours')
  WHERE user_id = uid AND plan = 'free';

  IF mail = 'theyashpawar92@gmail.com' THEN
    UPDATE public.subscriptions
      SET plan = 'lifetime', status = 'active', price_inr = 0,
          current_period_end = NULL, trial_ends_at = NULL, updated_at = now()
    WHERE user_id = uid;
  END IF;
END;
$function$;

ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;