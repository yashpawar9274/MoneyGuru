REVOKE EXECUTE ON FUNCTION public.activate_pro() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_paid_order(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_debt_receipt_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_account() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;