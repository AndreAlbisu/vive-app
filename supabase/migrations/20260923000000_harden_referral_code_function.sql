-- The referral-code generator is an internal helper called by mi_codigo_referido().
-- It does not need to be exposed as an RPC to clients.
ALTER FUNCTION public.nuevo_codigo_referido() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.nuevo_codigo_referido() FROM PUBLIC, anon, authenticated;
