-- Pro can no longer be self-granted for free from the client; only paid fulfilment activates it.
REVOKE ALL ON FUNCTION public.activate_pro() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pro() TO service_role;