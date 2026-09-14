-- Non-destructive. No finance tables or existing records are changed.
BEGIN;

CREATE TABLE IF NOT EXISTS public.guru_request_quota (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('chat', 'speech')),
  day_start date NOT NULL,
  day_count integer NOT NULL DEFAULT 0 CHECK (day_count >= 0),
  minute_start timestamptz NOT NULL,
  minute_count integer NOT NULL DEFAULT 0 CHECK (minute_count >= 0),
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE public.guru_request_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guru_request_quota FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.guru_request_quota TO authenticated;
GRANT ALL ON TABLE public.guru_request_quota TO service_role;
DROP POLICY IF EXISTS "read own guru quota" ON public.guru_request_quota;
CREATE POLICY "read own guru quota" ON public.guru_request_quota FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.consume_guru_quota(p_kind text)
RETURNS TABLE(allowed boolean, reason text, retry_after integer, remaining_today integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  stamp timestamptz := clock_timestamp();
  today date := (stamp AT TIME ZONE 'UTC')::date;
  minute_bucket timestamptz := date_trunc('minute', stamp);
  minute_limit integer;
  daily_limit CONSTANT integer := 60;
  q public.guru_request_quota%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('chat', 'speech') THEN
    RAISE EXCEPTION 'invalid quota kind' USING ERRCODE = '22023';
  END IF;
  -- Rechecked here too: direct RPC calls cannot gain premium access.
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.user_id = uid AND s.status = 'active'
    AND (s.plan = 'lifetime' OR (s.plan IN ('weekly', 'pro')
      AND isfinite(s.current_period_end) AND s.current_period_end > stamp))
  ) THEN
    RETURN QUERY SELECT false, 'premium_required'::text, 0, 0;
    RETURN;
  END IF;
  minute_limit := CASE WHEN p_kind = 'chat' THEN 8 ELSE 12 END;
  INSERT INTO public.guru_request_quota(user_id, kind, day_start, minute_start)
    VALUES(uid, p_kind, today, minute_bucket) ON CONFLICT DO NOTHING;
  -- Row lock serializes simultaneous requests across devices and server instances.
  SELECT * INTO q FROM public.guru_request_quota WHERE user_id = uid AND kind = p_kind FOR UPDATE;
  -- Use the time after any lock wait so concurrent requests cannot reset an older bucket.
  stamp := clock_timestamp();
  today := (stamp AT TIME ZONE 'UTC')::date;
  minute_bucket := date_trunc('minute', stamp);
  IF q.day_start <> today THEN q.day_count := 0; END IF;
  IF q.minute_start <> minute_bucket THEN q.minute_count := 0; END IF;
  IF q.day_count >= daily_limit THEN
    RETURN QUERY SELECT false, 'daily_limit'::text,
      greatest(1, ceil(extract(epoch FROM (((today + 1)::timestamp AT TIME ZONE 'UTC') - stamp)))::integer), 0;
    RETURN;
  END IF;
  IF q.minute_count >= minute_limit THEN
    RETURN QUERY SELECT false, 'minute_limit'::text,
      greatest(1, ceil(extract(epoch FROM (minute_bucket + interval '1 minute' - stamp)))::integer),
      daily_limit - q.day_count;
    RETURN;
  END IF;
  UPDATE public.guru_request_quota SET day_start = today, day_count = q.day_count + 1,
    minute_start = minute_bucket, minute_count = q.minute_count + 1 WHERE user_id = uid AND kind = p_kind;
  RETURN QUERY SELECT true, 'ok'::text, 0, daily_limit - q.day_count - 1;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_guru_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_guru_quota(text) TO authenticated;
COMMIT;
