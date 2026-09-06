REVOKE ALL ON FUNCTION public.activate_pro() FROM anon;
REVOKE ALL ON FUNCTION public.apply_paid_order(text) FROM anon;
REVOKE ALL ON FUNCTION public.bootstrap_account() FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.apply_paid_order(text) FROM authenticated;