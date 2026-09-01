REVOKE ALL ON FUNCTION public.bootstrap_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.activate_pro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pro() TO authenticated;