
-- Fix family_members RLS: enforce ownership through families table
DROP POLICY "Users can manage own family members" ON public.family_members;

CREATE POLICY "family_members_select" ON public.family_members FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.families WHERE families.id = family_members.family_id AND families.owner_id = auth.uid()));

CREATE POLICY "family_members_insert" ON public.family_members FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.families WHERE families.id = family_members.family_id AND families.owner_id = auth.uid()));

CREATE POLICY "family_members_update" ON public.family_members FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.families WHERE families.id = family_members.family_id AND families.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.families WHERE families.id = family_members.family_id AND families.owner_id = auth.uid()));

CREATE POLICY "family_members_delete" ON public.family_members FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.families WHERE families.id = family_members.family_id AND families.owner_id = auth.uid()));

-- Fix storage RLS: enforce file ownership through families table
DROP POLICY "Users can view own files" ON storage.objects;
DROP POLICY "Users can delete own files" ON storage.objects;
DROP POLICY "Users can upload files" ON storage.objects;

CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'family-documents' AND EXISTS (SELECT 1 FROM public.families WHERE id::text = (storage.foldername(name))[1] AND owner_id = auth.uid()));

CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'family-documents' AND EXISTS (SELECT 1 FROM public.families WHERE id::text = (storage.foldername(name))[1] AND owner_id = auth.uid()));

CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'family-documents' AND EXISTS (SELECT 1 FROM public.families WHERE id::text = (storage.foldername(name))[1] AND owner_id = auth.uid()));
