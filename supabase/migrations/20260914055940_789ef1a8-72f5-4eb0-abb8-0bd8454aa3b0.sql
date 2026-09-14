CREATE OR REPLACE FUNCTION public.consume_guru_voice_quota(_user_id uuid, _limit integer DEFAULT 30, _window interval DEFAULT interval '1 hour')
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _allowed boolean := false;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;
  IF _limit < 1 OR _limit > 120 OR _window < interval '1 minute' OR _window > interval '24 hours' THEN
    RAISE EXCEPTION 'Invalid quota configuration';
  END IF;

  INSERT INTO public.guru_voice_quota AS q (user_id, window_start, request_count, updated_at)
  VALUES (_user_id, now(), 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET window_start = CASE WHEN q.window_start + _window <= now() THEN now() ELSE q.window_start END,
      request_count = CASE WHEN q.window_start + _window <= now() THEN 1 ELSE q.request_count + 1 END,
      updated_at = now()
  WHERE q.window_start + _window <= now() OR q.request_count < _limit
  RETURNING true INTO _allowed;

  RETURN COALESCE(_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_guru_voice_quota(integer, interval) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.consume_guru_voice_quota(uuid, integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guru_voice_quota(uuid, integer, interval) TO service_role;