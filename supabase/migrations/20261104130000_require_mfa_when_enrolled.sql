-- SEC-5: once a user has a verified MFA factor, a password-only (aal1) session
-- gets no family data. Enforced here so it cannot be skipped by calling the API
-- directly. Restrictive policies combine with AND on top of the existing policies.

CREATE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT auth.jwt()) ->> 'aal', '') = 'aal2'
    OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id = (SELECT auth.uid()) AND f.status = 'verified'
    );
$$;

REVOKE ALL ON FUNCTION public.mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO authenticated;

CREATE POLICY "require_mfa" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

CREATE POLICY "require_mfa" ON public.families AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

CREATE POLICY "require_mfa" ON public.family_members AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

CREATE POLICY "require_mfa" ON public.documents AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

CREATE POLICY "require_mfa" ON public.user_settings AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

CREATE POLICY "family_documents_require_mfa" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id <> 'family-documents' OR public.mfa_satisfied())
WITH CHECK (bucket_id <> 'family-documents' OR public.mfa_satisfied());
