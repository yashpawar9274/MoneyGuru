REVOKE EXECUTE ON FUNCTION public.activate_pro() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_paid_order(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_debt_receipt_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pro() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_paid_order(text) TO service_role;