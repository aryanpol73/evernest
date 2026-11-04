-- SEC-11: one-time recovery codes for a lost authenticator.
-- A code bypasses MFA, so redeeming one still needs a fresh sign-in. It replaces the
-- second factor, and never the first.

CREATE TABLE private.mfa_recovery_codes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Codes carry 80 random bits, so a plain hash cannot be brute forced.
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mfa_recovery_codes_user_idx ON private.mfa_recovery_codes (user_id);

CREATE TABLE private.mfa_recovery_attempts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

ALTER TABLE public.audit_events DROP CONSTRAINT audit_events_action_check;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_check CHECK (action IN (
  'document_uploaded', 'document_updated', 'document_deleted',
  'document_viewed', 'document_downloaded',
  'member_added', 'member_updated', 'member_removed',
  'pin_set', 'pin_removed', 'pin_failed', 'pin_locked',
  'invite_created', 'invite_revoked',
  'access_granted', 'access_changed', 'access_removed',
  'mfa_recovery_codes_created', 'mfa_recovery_used', 'mfa_recovery_failed'
));

CREATE FUNCTION private.record_account_event(_user_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  family uuid;
BEGIN
  SELECT id INTO family FROM public.families WHERE owner_id = _user_id LIMIT 1;
  IF family IS NOT NULL THEN
    PERFORM private.record_event(family, _action, NULL, NULL);
  END IF;
END;
$$;

CREATE FUNCTION public.generate_mfa_recovery_codes()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := (SELECT auth.uid());
  raw text;
  codes text[] := '{}';
BEGIN
  -- mfa_satisfied() is true for accounts with no MFA, so the claim is checked directly.
  IF COALESCE((SELECT auth.jwt()) ->> 'aal', '') <> 'aal2' OR NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = uid AND f.status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Verify with your authenticator first' USING ERRCODE = '42501';
  END IF;

  DELETE FROM private.mfa_recovery_codes WHERE user_id = uid;

  FOR i IN 1..10 LOOP
    raw := upper(encode(extensions.gen_random_bytes(10), 'hex'));
    INSERT INTO private.mfa_recovery_codes (user_id, code_hash)
    VALUES (uid, encode(extensions.digest(raw, 'sha256'), 'hex'));
    codes := codes || regexp_replace(raw, '(.{4})(?=.)', '\1-', 'g');
  END LOOP;

  PERFORM private.record_account_event(uid, 'mfa_recovery_codes_created');
  RETURN codes;
END;
$$;

CREATE FUNCTION public.mfa_recovery_codes_remaining()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'Verify with your authenticator first' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT count(*) FROM private.mfa_recovery_codes c WHERE c.user_id = (SELECT auth.uid()));
END;
$$;

-- Returns a result instead of raising, because raising would roll back the attempt
-- counter. Using a code removes MFA and every other code, so the user must set MFA
-- up again.
CREATE FUNCTION public.redeem_mfa_recovery_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  max_attempts CONSTANT integer := 5;
  uid uuid := (SELECT auth.uid());
  normalized text := upper(regexp_replace(COALESCE(_code, ''), '[^0-9A-Fa-f]', '', 'g'));
  attempt private.mfa_recovery_attempts%ROWTYPE;
  so_far integer;
  new_lock timestamptz;
BEGIN
  IF uid IS NULL OR NOT private.has_recent_sign_in() THEN
    RAISE EXCEPTION 'A recent sign-in is required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO private.mfa_recovery_attempts (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO attempt FROM private.mfa_recovery_attempts WHERE user_id = uid FOR UPDATE;

  IF attempt.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'locked_until', attempt.locked_until);
  END IF;

  -- Codes older than the current authenticator belong to an earlier setup.
  IF EXISTS (
    SELECT 1 FROM private.mfa_recovery_codes c
    WHERE c.user_id = uid
      AND c.code_hash = encode(extensions.digest(normalized, 'sha256'), 'hex')
      AND c.created_at >= (
        SELECT max(f.created_at) FROM auth.mfa_factors f WHERE f.user_id = uid AND f.status = 'verified'
      )
  ) THEN
    DELETE FROM private.mfa_recovery_codes WHERE user_id = uid;
    DELETE FROM auth.mfa_factors WHERE user_id = uid;
    UPDATE private.mfa_recovery_attempts SET attempts = 0, locked_until = NULL WHERE user_id = uid;
    PERFORM private.record_account_event(uid, 'mfa_recovery_used');
    RETURN jsonb_build_object('ok', true, 'locked_until', NULL);
  END IF;

  so_far := CASE WHEN attempt.locked_until IS NULL THEN attempt.attempts ELSE 0 END + 1;
  new_lock := CASE WHEN so_far >= max_attempts THEN now() + interval '30 minutes' END;
  UPDATE private.mfa_recovery_attempts SET attempts = so_far, locked_until = new_lock WHERE user_id = uid;
  PERFORM private.record_account_event(uid, 'mfa_recovery_failed');

  RETURN jsonb_build_object('ok', false, 'locked_until', new_lock);
END;
$$;

REVOKE ALL ON FUNCTION public.generate_mfa_recovery_codes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mfa_recovery_codes_remaining() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_mfa_recovery_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_mfa_recovery_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_codes_remaining() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_mfa_recovery_code(text) TO authenticated;
