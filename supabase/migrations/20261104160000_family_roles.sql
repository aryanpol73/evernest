-- FEAT-1: shared families with owner, editor, and viewer roles.
--   owner:  everything, including access, the family name, and the audit log.
--   editor: add, change, and delete members and documents.
--   viewer: read only.

CREATE TABLE public.family_memberships (
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE INDEX family_memberships_user_idx ON public.family_memberships (user_id);

INSERT INTO public.family_memberships (family_id, user_id, role)
SELECT id, owner_id, 'owner' FROM public.families;

CREATE FUNCTION private.add_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.family_memberships (family_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NULL;
END;
$$;

CREATE TRIGGER add_owner_membership
  AFTER INSERT ON public.families
  FOR EACH ROW EXECUTE FUNCTION private.add_owner_membership();

-- ---------------------------------------------------------------------------
-- Role checks. These bypass RLS so that policies on family_memberships can use them.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.family_role(_family_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.role FROM public.family_memberships m
  WHERE m.family_id = _family_id AND m.user_id = (SELECT auth.uid());
$$;

CREATE FUNCTION public.can_read_family(_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.family_role(_family_id) IS NOT NULL;
$$;

CREATE FUNCTION public.can_edit_family(_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.family_role(_family_id) IN ('owner', 'editor'), false);
$$;

-- Takes the path as an argument for the reason given in the hardening migration.
CREATE FUNCTION public.storage_path_role(_path text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.role FROM public.family_memberships m
  WHERE m.family_id::text = (storage.foldername(_path))[1]
    AND m.user_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.family_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_family(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_family(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_path_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_family(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_family(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_path_role(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Clients can read memberships but never write them, so a role can only change
-- through the owner-checked functions below.
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_memberships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.family_memberships TO authenticated;

CREATE POLICY "family_memberships_select" ON public.family_memberships FOR SELECT TO authenticated
USING (public.can_read_family(family_id));

CREATE POLICY "require_mfa" ON public.family_memberships AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

-- ---------------------------------------------------------------------------
-- Family data follows the role instead of the owner.
-- ---------------------------------------------------------------------------
CREATE POLICY "families_select_members" ON public.families FOR SELECT TO authenticated
USING (public.can_read_family(id));

DROP POLICY "family_members_select" ON public.family_members;
DROP POLICY "family_members_insert" ON public.family_members;
DROP POLICY "family_members_update" ON public.family_members;
DROP POLICY "family_members_delete" ON public.family_members;

CREATE POLICY "family_members_select" ON public.family_members FOR SELECT TO authenticated
USING (public.can_read_family(family_id));

CREATE POLICY "family_members_insert" ON public.family_members FOR INSERT TO authenticated
WITH CHECK (public.can_edit_family(family_id) AND user_id = (SELECT auth.uid()));

CREATE POLICY "family_members_update" ON public.family_members FOR UPDATE TO authenticated
USING (public.can_edit_family(family_id))
WITH CHECK (public.can_edit_family(family_id));

CREATE POLICY "family_members_delete" ON public.family_members FOR DELETE TO authenticated
USING (public.can_edit_family(family_id));

DROP POLICY "documents_select" ON public.documents;
DROP POLICY "documents_insert" ON public.documents;
DROP POLICY "documents_update" ON public.documents;
DROP POLICY "documents_delete" ON public.documents;

CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
USING (public.can_read_family(family_id));

CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.can_edit_family(family_id) AND user_id = (SELECT auth.uid()));

CREATE POLICY "documents_update" ON public.documents FOR UPDATE TO authenticated
USING (public.can_edit_family(family_id))
WITH CHECK (public.can_edit_family(family_id));

CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
USING (public.can_edit_family(family_id));

DROP POLICY "Users can view own files" ON storage.objects;
DROP POLICY "Users can delete own files" ON storage.objects;
DROP POLICY "Users can upload files" ON storage.objects;

CREATE POLICY "Family can view files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'family-documents' AND public.storage_path_role(name) IS NOT NULL);

CREATE POLICY "Family editors can delete files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'family-documents' AND public.storage_path_role(name) IN ('owner', 'editor'));

CREATE POLICY "Family editors can upload files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'family-documents' AND public.storage_path_role(name) IN ('owner', 'editor'));

-- A record belongs to its family, so it must outlive the account of whoever created
-- it. These columns cascaded before, which would have let an editor deleting their
-- own account destroy what they had added to someone else's family.
ALTER TABLE public.documents
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT documents_user_id_fkey,
  ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.family_members
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT family_members_user_id_fkey,
  ADD CONSTRAINT family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Editors can change a record's content, but not who created it or which family it
-- is in. NULL has to pass for the ON DELETE SET NULL above.
CREATE FUNCTION private.keep_record_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.family_id := OLD.family_id;
  IF NEW.user_id IS NOT NULL THEN
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER keep_record_ownership
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.keep_record_ownership();

CREATE TRIGGER keep_record_ownership
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION private.keep_record_ownership();

-- ---------------------------------------------------------------------------
-- Functions that assumed one owner.
-- ---------------------------------------------------------------------------

-- Account deletion removes these files, so this must never include a family the
-- caller was only invited to.
CREATE OR REPLACE FUNCTION public.list_my_storage_paths()
RETURNS SETOF text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id = 'family-documents' AND public.storage_path_role(o.name) = 'owner';
$$;

CREATE OR REPLACE FUNCTION public.record_document_access(_document_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  doc public.documents%ROWTYPE;
BEGIN
  IF _action NOT IN ('document_viewed', 'document_downloaded') THEN
    RAISE EXCEPTION 'Unknown document action' USING ERRCODE = '22023';
  END IF;

  -- This function bypasses RLS, so the same checks are made explicitly.
  SELECT d.* INTO doc FROM public.documents d
  WHERE d.id = _document_id AND public.can_read_family(d.family_id);

  IF NOT FOUND OR NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'Document not found' USING ERRCODE = '42501';
  END IF;

  PERFORM private.record_event(doc.family_id, _action, doc.id, doc.name, 'client');
END;
$$;

-- ---------------------------------------------------------------------------
-- Invites. A link is a bearer token, so only its hash is stored, and it works only
-- for the invited address, once that address is confirmed.
-- ---------------------------------------------------------------------------
CREATE TABLE public.family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email)),
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX family_invites_one_pending_idx ON public.family_invites (family_id, email)
WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, family_id, email, role, created_at, expires_at, accepted_at, revoked_at)
  ON public.family_invites TO authenticated;

CREATE POLICY "family_invites_select" ON public.family_invites FOR SELECT TO authenticated
USING (public.family_role(family_id) = 'owner');

CREATE POLICY "require_mfa" ON public.family_invites AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

CREATE FUNCTION private.require_family_owner(_family_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF public.family_role(_family_id) IS DISTINCT FROM 'owner' OR NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'Only the family owner can do this' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION public.create_family_invite(_family_id uuid, _email text, _role text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  max_pending CONSTANT integer := 20;
  invited_email text := lower(trim(_email));
  token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  PERFORM private.require_family_owner(_family_id);

  IF _role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'Role must be editor or viewer' USING ERRCODE = '22023';
  END IF;
  IF invited_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.family_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.family_id = _family_id AND lower(u.email) = invited_email
  ) THEN
    RAISE EXCEPTION 'That person is already in this family' USING ERRCODE = '23505';
  END IF;

  -- A new invite replaces any earlier link for the same address.
  UPDATE public.family_invites SET revoked_at = now()
  WHERE family_id = _family_id AND email = invited_email AND accepted_at IS NULL AND revoked_at IS NULL;

  IF (
    SELECT count(*) FROM public.family_invites
    WHERE family_id = _family_id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  ) >= max_pending THEN
    RAISE EXCEPTION 'Too many pending invites. Revoke some first.' USING ERRCODE = '53400';
  END IF;

  INSERT INTO public.family_invites (family_id, email, role, token_hash, invited_by)
  VALUES (_family_id, invited_email, _role, encode(extensions.digest(token, 'sha256'), 'hex'), (SELECT auth.uid()));

  RETURN token;
END;
$$;

CREATE FUNCTION public.revoke_family_invite(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  family uuid;
BEGIN
  SELECT family_id INTO family FROM public.family_invites WHERE id = _invite_id;
  PERFORM private.require_family_owner(family);

  UPDATE public.family_invites SET revoked_at = now()
  WHERE id = _invite_id AND accepted_at IS NULL AND revoked_at IS NULL;
END;
$$;

-- Every failure gives the same message, so a caller can't learn whether a token
-- exists, was used, or belongs to someone else.
CREATE FUNCTION private.usable_invite(_token text)
RETURNS public.family_invites
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  invite public.family_invites%ROWTYPE;
BEGIN
  SELECT i.* INTO invite
  FROM public.family_invites i
  JOIN auth.users u ON u.id = (SELECT auth.uid())
  WHERE i.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
    AND i.accepted_at IS NULL
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
    AND u.email_confirmed_at IS NOT NULL
    AND lower(u.email) = i.email
  FOR UPDATE OF i;

  IF NOT FOUND OR NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'This invite is not valid for this account' USING ERRCODE = '42501';
  END IF;

  RETURN invite;
END;
$$;

CREATE FUNCTION public.preview_family_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invite public.family_invites%ROWTYPE := private.usable_invite(_token);
BEGIN
  RETURN jsonb_build_object(
    'family_name', (SELECT f.name FROM public.families f WHERE f.id = invite.family_id),
    'role', invite.role
  );
END;
$$;

CREATE FUNCTION public.accept_family_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invite public.family_invites%ROWTYPE := private.usable_invite(_token);
BEGIN
  -- An existing role is left alone, so an invite can never demote an owner.
  INSERT INTO public.family_memberships (family_id, user_id, role)
  VALUES (invite.family_id, (SELECT auth.uid()), invite.role)
  ON CONFLICT (family_id, user_id) DO NOTHING;

  UPDATE public.family_invites SET accepted_at = now() WHERE id = invite.id;

  RETURN invite.family_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Managing access.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.list_family_access(_family_id uuid)
RETURNS TABLE (user_id uuid, email text, full_name text, role text, joined_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.can_read_family(_family_id) OR NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'Family not found' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.user_id, u.email::text, p.full_name, m.role, m.created_at
  FROM public.family_memberships m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.family_id = _family_id
  ORDER BY m.created_at;
END;
$$;

CREATE FUNCTION public.set_family_role(_family_id uuid, _user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_family_owner(_family_id);

  IF _role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'Role must be editor or viewer' USING ERRCODE = '22023';
  END IF;

  UPDATE public.family_memberships SET role = _role
  WHERE family_id = _family_id AND user_id = _user_id AND role <> 'owner';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person cannot be changed' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- Owners can remove anyone else, and anyone but the owner can leave.
CREATE FUNCTION public.remove_family_access(_family_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    PERFORM private.require_family_owner(_family_id);
  ELSIF NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'Only the family owner can do this' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.family_memberships
  WHERE family_id = _family_id AND user_id = _user_id AND role <> 'owner';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person cannot be removed' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_family_invite(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_family_invite(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_family_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_family_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_family_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_family_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_family_access(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_family_invite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_family_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_family_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_family_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_family_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_family_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_family_access(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Access changes go in the audit log.
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
  'document_uploaded', 'document_updated', 'document_deleted',
  'document_viewed', 'document_downloaded',
  'member_added', 'member_updated', 'member_removed',
  'pin_set', 'pin_removed', 'pin_failed', 'pin_locked',
  'invite_created', 'invite_revoked',
  'access_granted', 'access_changed', 'access_removed'
));

CREATE FUNCTION private.audit_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  person uuid := COALESCE(NEW.user_id, OLD.user_id);
  person_email text;
BEGIN
  SELECT u.email INTO person_email FROM auth.users u WHERE u.id = person;

  IF TG_OP = 'INSERT' AND NEW.role <> 'owner' THEN
    PERFORM private.record_event(NEW.family_id, 'access_granted', person, person_email);
  ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM private.record_event(NEW.family_id, 'access_changed', person, person_email);
  ELSIF TG_OP = 'DELETE' AND OLD.role <> 'owner' THEN
    PERFORM private.record_event(OLD.family_id, 'access_removed', person, person_email);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_family_memberships
  AFTER INSERT OR UPDATE OR DELETE ON public.family_memberships
  FOR EACH ROW EXECUTE FUNCTION private.audit_access_change();

CREATE FUNCTION private.audit_invite_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.record_event(NEW.family_id, 'invite_created', NEW.id, NEW.email);
  ELSIF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    PERFORM private.record_event(NEW.family_id, 'invite_revoked', NEW.id, NEW.email);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_family_invites
  AFTER INSERT OR UPDATE ON public.family_invites
  FOR EACH ROW EXECUTE FUNCTION private.audit_invite_change();
