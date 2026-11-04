-- SEC-1: family isolation and storage limits.
-- SEC-2: server-side PIN verification.
-- Deploy with the matching client. Clients older than this migration read
-- pin_hash directly and will stop showing the PIN lock.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- SEC-1: a row may only reference members of its own family.
-- These constraints fail loudly if cross-family rows already exist.
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_id_family_key UNIQUE (id, family_id);

ALTER TABLE public.family_members
  DROP CONSTRAINT family_members_parent_member_id_fkey,
  ADD CONSTRAINT family_members_parent_same_family
    FOREIGN KEY (parent_member_id, family_id)
    REFERENCES public.family_members (id, family_id)
    ON DELETE SET NULL (parent_member_id);

ALTER TABLE public.documents
  DROP CONSTRAINT documents_member_id_fkey,
  ADD CONSTRAINT documents_member_same_family
    FOREIGN KEY (member_id, family_id)
    REFERENCES public.family_members (id, family_id)
    ON DELETE SET NULL (member_id);

ALTER TABLE public.documents
  ADD CONSTRAINT documents_file_path_in_family
    CHECK (split_part(file_path, '/', 1) = family_id::text);

-- ---------------------------------------------------------------------------
-- SEC-1: RLS requires ownership of the family, not just a matching user_id.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.owns_family(_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = _family_id AND f.owner_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.owns_family(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_family(uuid) TO authenticated;

DROP POLICY "Users can manage own documents" ON public.documents;

CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
USING (public.owns_family(family_id));

CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
WITH CHECK (public.owns_family(family_id) AND user_id = (SELECT auth.uid()));

CREATE POLICY "documents_update" ON public.documents FOR UPDATE TO authenticated
USING (public.owns_family(family_id))
WITH CHECK (public.owns_family(family_id) AND user_id = (SELECT auth.uid()));

CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
USING (public.owns_family(family_id));

DROP POLICY "family_members_insert" ON public.family_members;
DROP POLICY "family_members_update" ON public.family_members;

CREATE POLICY "family_members_insert" ON public.family_members FOR INSERT TO authenticated
WITH CHECK (public.owns_family(family_id) AND user_id = (SELECT auth.uid()));

CREATE POLICY "family_members_update" ON public.family_members FOR UPDATE TO authenticated
USING (public.owns_family(family_id))
WITH CHECK (public.owns_family(family_id) AND user_id = (SELECT auth.uid()));

-- The previous storage policies called foldername(name) inside a subquery on
-- public.families, so "name" bound to families.name rather than the object path.
-- That refused legitimate uploads, and let any user reach every family's files
-- by renaming their family to '<their family id>/x'. Passing the path as a
-- function argument removes the ambiguity.
CREATE FUNCTION public.owns_storage_path(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id::text = (storage.foldername(_path))[1]
      AND f.owner_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.owns_storage_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_storage_path(text) TO authenticated;

DROP POLICY "Users can view own files" ON storage.objects;
DROP POLICY "Users can delete own files" ON storage.objects;
DROP POLICY "Users can upload files" ON storage.objects;

CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'family-documents' AND public.owns_storage_path(name));

CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'family-documents' AND public.owns_storage_path(name));

CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'family-documents' AND public.owns_storage_path(name));

-- Storage enforces size and declared type. Content sniffing is not performed,
-- so clients must still treat stored files as untrusted.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'family-documents';

-- ---------------------------------------------------------------------------
-- SEC-2: PIN secrets live in a schema the API cannot reach.
-- ---------------------------------------------------------------------------
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- A live session is not proof of who is using it, so sensitive actions need a sign-in
-- from the last five minutes. Google accounts have no password, so oauth counts too.
-- Reset links and one-time codes don't, because they only prove access to the inbox.
CREATE FUNCTION private.has_recent_sign_in()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE((SELECT auth.jwt()) -> 'amr', '[]'::jsonb)) AS entry
    WHERE entry->>'method' IN ('password', 'oauth')
      AND (entry->>'timestamp')::bigint >= extract(epoch FROM now())::bigint - 300
  );
$$;

CREATE TABLE private.user_pins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT,
  -- Pre-migration SHA-256 values, replaced by bcrypt on the next correct entry.
  legacy_sha256 TEXT,
  legacy_salt TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_pins_has_secret CHECK (
    pin_hash IS NOT NULL OR (legacy_sha256 IS NOT NULL AND legacy_salt IS NOT NULL)
  )
);

INSERT INTO private.user_pins (user_id, legacy_sha256, legacy_salt, attempts, locked_until)
SELECT id, pin_hash, pin_salt, pin_attempts, pin_locked_until
FROM public.user_settings
WHERE pin_hash IS NOT NULL AND pin_salt IS NOT NULL;

ALTER TABLE public.user_settings
  DROP COLUMN pin_hash,
  DROP COLUMN pin_salt,
  DROP COLUMN pin_attempts,
  DROP COLUMN pin_locked_until;

-- Checks a PIN and records the outcome. Returns a result instead of raising,
-- because raising would roll back the failed-attempt counter.
CREATE FUNCTION private.check_pin(_user_id uuid, _pin text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  max_attempts CONSTANT integer := 5;
  pin_row private.user_pins%ROWTYPE;
  attempts_so_far integer;
  is_match boolean;
  new_lock timestamptz;
BEGIN
  SELECT * INTO pin_row FROM private.user_pins WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'locked_until', NULL, 'attempts_remaining', 0);
  END IF;

  IF pin_row.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'locked_until', pin_row.locked_until, 'attempts_remaining', 0);
  END IF;

  -- An expired lockout starts a fresh set of attempts.
  attempts_so_far := CASE WHEN pin_row.locked_until IS NULL THEN pin_row.attempts ELSE 0 END;

  IF pin_row.pin_hash IS NOT NULL THEN
    is_match := pin_row.pin_hash = extensions.crypt(_pin, pin_row.pin_hash);
  ELSE
    is_match := pin_row.legacy_sha256 =
      encode(extensions.digest(_pin || pin_row.legacy_salt, 'sha256'), 'hex');
  END IF;

  IF is_match THEN
    UPDATE private.user_pins
    SET attempts = 0,
        locked_until = NULL,
        pin_hash = COALESCE(pin_row.pin_hash, extensions.crypt(_pin, extensions.gen_salt('bf', 10))),
        legacy_sha256 = NULL,
        legacy_salt = NULL,
        updated_at = now()
    WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'locked_until', NULL, 'attempts_remaining', max_attempts);
  END IF;

  attempts_so_far := attempts_so_far + 1;
  new_lock := CASE WHEN attempts_so_far >= max_attempts THEN now() + interval '30 minutes' END;

  UPDATE private.user_pins
  SET attempts = attempts_so_far, locked_until = new_lock, updated_at = now()
  WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'ok', false,
    'locked_until', new_lock,
    'attempts_remaining', GREATEST(max_attempts - attempts_so_far, 0)
  );
END;
$$;

CREATE FUNCTION private.require_valid_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF _pin IS NULL OR _pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 6 digits' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE FUNCTION public.pin_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'has_pin', p.user_id IS NOT NULL,
    'locked_until', CASE WHEN p.locked_until > now() THEN p.locked_until END
  )
  FROM (SELECT 1) AS one
  LEFT JOIN private.user_pins p ON p.user_id = (SELECT auth.uid());
$$;

CREATE FUNCTION public.verify_pin(_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.require_valid_pin(_pin);
  RETURN private.check_pin((SELECT auth.uid()), _pin);
END;
$$;

-- Changing a PIN requires the current one, so a stolen session cannot replace it.
CREATE FUNCTION public.set_pin(_new_pin text, _current_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  result jsonb;
BEGIN
  PERFORM private.require_valid_pin(_new_pin);

  IF EXISTS (SELECT 1 FROM private.user_pins WHERE user_id = uid) THEN
    PERFORM private.require_valid_pin(_current_pin);
    result := private.check_pin(uid, _current_pin);
    IF NOT (result->>'ok')::boolean THEN
      RETURN result;
    END IF;
  END IF;

  INSERT INTO private.user_pins (user_id, pin_hash)
  VALUES (uid, extensions.crypt(_new_pin, extensions.gen_salt('bf', 10)))
  ON CONFLICT (user_id) DO UPDATE
  SET pin_hash = EXCLUDED.pin_hash,
      legacy_sha256 = NULL,
      legacy_salt = NULL,
      attempts = 0,
      locked_until = NULL,
      updated_at = now();

  RETURN jsonb_build_object('ok', true, 'locked_until', NULL, 'attempts_remaining', 5);
END;
$$;

CREATE FUNCTION public.remove_pin(_current_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  result jsonb;
BEGIN
  PERFORM private.require_valid_pin(_current_pin);
  result := private.check_pin(uid, _current_pin);
  IF (result->>'ok')::boolean THEN
    DELETE FROM private.user_pins WHERE user_id = uid;
  END IF;
  RETURN result;
END;
$$;

-- Forgotten-PIN recovery. The caller must have just signed in again.
CREATE FUNCTION public.reset_pin_after_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_recent_sign_in() THEN
    RAISE EXCEPTION 'A recent sign-in is required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM private.user_pins WHERE user_id = (SELECT auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.pin_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_pin(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_pin_after_login() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pin_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_pin_after_login() TO authenticated;
