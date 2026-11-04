-- Accounts created before the signup trigger existed have no profile, settings, or
-- family, so they cannot use the app. Safe to run more than once.

INSERT INTO public.profiles (id, full_name)
SELECT u.id, u.raw_user_meta_data->>'full_name' FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_settings (id)
SELECT u.id FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- The trigger from the family roles migration adds the owner membership.
INSERT INTO public.families (owner_id, name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', 'My') || '''s Family'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.families f WHERE f.owner_id = u.id);
