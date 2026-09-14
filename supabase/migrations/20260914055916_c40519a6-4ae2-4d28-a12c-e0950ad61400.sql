CREATE TABLE public.guru_voice_quota (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guru_voice_quota TO authenticated;
GRANT ALL ON public.guru_voice_quota TO service_role;

ALTER TABLE public.guru_voice_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Guru usage"
ON public.guru_voice_quota
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_guru_voice_quota(_limit integer DEFAULT 30, _window interval DEFAULT interval '1 hour')
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN false;
  END IF;
  IF _limit < 1 OR _limit > 120 OR _window < interval '1 minute' OR _window > interval '24 hours' THEN
    RAISE EXCEPTION 'Invalid quota configuration';
  END IF;

  INSERT INTO public.guru_voice_quota AS q (user_id, window_start, request_count, updated_at)
  VALUES (_uid, now(), 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET window_start = CASE WHEN q.window_start + _window <= now() THEN now() ELSE q.window_start END,
      request_count = CASE WHEN q.window_start + _window <= now() THEN 1 ELSE q.request_count + 1 END,
      updated_at = now()
  WHERE q.window_start + _window <= now() OR q.request_count < _limit
  RETURNING true INTO _allowed;

  RETURN COALESCE(_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_guru_voice_quota(integer, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_guru_voice_quota(integer, interval) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guru_voice_quota(integer, interval) TO service_role;