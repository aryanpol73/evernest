-- SEC-6: append-only audit log.
-- source = 'server': written by triggers, so clients cannot skip or forge it.
-- source = 'client': views and downloads reported by the app. Files are read
-- directly from Storage, so these rows show normal use and are not proof that
-- nothing else was read.

CREATE TABLE public.audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL CHECK (action IN (
    'document_uploaded', 'document_updated', 'document_deleted',
    'document_viewed', 'document_downloaded',
    'member_added', 'member_updated', 'member_removed',
    'pin_set', 'pin_removed', 'pin_failed', 'pin_locked'
  )),
  target_id UUID,
  target_name TEXT,
  source TEXT NOT NULL DEFAULT 'server' CHECK (source IN ('server', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_family_created_idx ON public.audit_events (family_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges would otherwise allow writes through the API.
REVOKE ALL ON public.audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

CREATE POLICY "audit_events_select" ON public.audit_events FOR SELECT TO authenticated
USING (public.owns_family(family_id));

CREATE POLICY "require_mfa" ON public.audit_events AS RESTRICTIVE FOR ALL TO authenticated
USING (public.mfa_satisfied()) WITH CHECK (public.mfa_satisfied());

-- A row being deleted by a cascade from its family has no family left to log
-- against, and inserting one would fail the foreign key and block the deletion.
CREATE FUNCTION private.record_event(
  _family_id uuid, _action text, _target_id uuid, _target_name text, _source text DEFAULT 'server'
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.families WHERE id = _family_id) THEN
    INSERT INTO public.audit_events (family_id, actor_id, action, target_id, target_name, source)
    VALUES (_family_id, (SELECT auth.uid()), _action, _target_id, _target_name, _source);
  END IF;
END;
$$;

CREATE FUNCTION private.audit_document_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.record_event(NEW.family_id, 'document_uploaded', NEW.id, NEW.name);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM private.record_event(OLD.family_id, 'document_deleted', OLD.id, OLD.name);
  -- dismissed_reminder is routine, and member_id is cleared when a member is removed.
  ELSIF (NEW.name, NEW.category, NEW.file_path, NEW.expiry_date, NEW.tags)
    IS DISTINCT FROM (OLD.name, OLD.category, OLD.file_path, OLD.expiry_date, OLD.tags) THEN
    PERFORM private.record_event(NEW.family_id, 'document_updated', NEW.id, NEW.name);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.audit_document_change();

CREATE FUNCTION private.audit_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.record_event(NEW.family_id, 'member_added', NEW.id, NEW.name);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM private.record_event(OLD.family_id, 'member_removed', OLD.id, OLD.name);
  -- parent_member_id is cleared automatically when a parent is removed.
  ELSIF (to_jsonb(NEW) - 'updated_at' - 'parent_member_id') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'parent_member_id') THEN
    PERFORM private.record_event(NEW.family_id, 'member_updated', NEW.id, NEW.name);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_family_members
  AFTER INSERT OR UPDATE OR DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION private.audit_member_change();

CREATE FUNCTION private.audit_pin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pin_owner uuid := COALESCE(NEW.user_id, OLD.user_id);
  family uuid;
BEGIN
  SELECT id INTO family FROM public.families WHERE owner_id = pin_owner LIMIT 1;
  IF family IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM private.record_event(family, 'pin_set', NULL, NULL);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM private.record_event(family, 'pin_removed', NULL, NULL);
  ELSE
    IF NEW.locked_until IS NOT NULL AND NEW.locked_until IS DISTINCT FROM OLD.locked_until THEN
      PERFORM private.record_event(family, 'pin_locked', NULL, NULL);
    ELSIF NEW.attempts > OLD.attempts
      OR (NEW.attempts = 1 AND OLD.locked_until IS NOT NULL AND NEW.locked_until IS NULL) THEN
      PERFORM private.record_event(family, 'pin_failed', NULL, NULL);
    END IF;
    -- The bcrypt upgrade of a legacy hash keeps the same PIN, so it isn't a change.
    IF NEW.pin_hash IS DISTINCT FROM OLD.pin_hash AND OLD.pin_hash IS NOT NULL THEN
      PERFORM private.record_event(family, 'pin_set', NULL, NULL);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER audit_user_pins
  AFTER INSERT OR UPDATE OR DELETE ON private.user_pins
  FOR EACH ROW EXECUTE FUNCTION private.audit_pin_change();

CREATE FUNCTION public.record_document_access(_document_id uuid, _action text)
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
  SELECT d.* INTO doc
  FROM public.documents d
  JOIN public.families f ON f.id = d.family_id
  WHERE d.id = _document_id AND f.owner_id = (SELECT auth.uid());

  IF NOT FOUND OR NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'Document not found' USING ERRCODE = '42501';
  END IF;

  PERFORM private.record_event(doc.family_id, _action, doc.id, doc.name, 'client');
END;
$$;

REVOKE ALL ON FUNCTION public.record_document_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_document_access(uuid, text) TO authenticated;
