-- SEC-9: account deletion, and a retention limit on the audit log.

-- Runs as the caller, so RLS limits it to the caller's own files.
CREATE FUNCTION public.list_my_storage_paths()
RETURNS SETOF text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT o.name FROM storage.objects o WHERE o.bucket_id = 'family-documents';
$$;

REVOKE ALL ON FUNCTION public.list_my_storage_paths() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_storage_paths() TO authenticated;

-- Deleting an account cannot be undone, so a session alone is not enough. The caller
-- must have signed in with a password in the last five minutes and completed MFA if
-- enrolled. Files must already be gone, because removing rows here would leave the
-- underlying objects in Storage.
CREATE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
BEGIN
  IF uid IS NULL OR NOT public.mfa_satisfied() OR NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE((SELECT auth.jwt()) -> 'amr', '[]'::jsonb)) AS entry
    WHERE entry->>'method' = 'password'
      AND (entry->>'timestamp')::bigint >= extract(epoch FROM now())::bigint - 300
  ) THEN
    RAISE EXCEPTION 'A recent sign-in is required to delete an account' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM storage.objects o
    JOIN public.families f ON f.id::text = (storage.foldername(o.name))[1]
    WHERE o.bucket_id = 'family-documents' AND f.owner_id = uid
  ) THEN
    RAISE EXCEPTION 'Stored files must be removed before the account' USING ERRCODE = '55000';
  END IF;

  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Events older than 12 months are purged as new ones arrive, so retention needs no
-- scheduler. A family with no new events keeps its old ones until the next event.
CREATE OR REPLACE FUNCTION private.record_event(
  _family_id uuid, _action text, _target_id uuid, _target_name text, _source text DEFAULT 'server'
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.families WHERE id = _family_id) THEN
    DELETE FROM public.audit_events
    WHERE family_id = _family_id AND created_at < now() - interval '12 months';

    INSERT INTO public.audit_events (family_id, actor_id, action, target_id, target_name, source)
    VALUES (_family_id, (SELECT auth.uid()), _action, _target_id, _target_name, _source);
  END IF;
END;
$$;
