BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.profile_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
 headline text NOT NULL CHECK(length(btrim(headline)) BETWEEN 2 AND 160),
 desired_profession_ids uuid[] NOT NULL DEFAULT '{}' CHECK(cardinality(desired_profession_ids)<=20),
 custom_professions text[] NOT NULL DEFAULT '{}' CHECK(cardinality(custom_professions)<=20 AND octet_length(custom_professions::text)<=2000),
 cities text[] NOT NULL DEFAULT '{}' CHECK(cardinality(cities)<=20 AND octet_length(cities::text)<=2000),
 travel_ready boolean NOT NULL DEFAULT false,availability text,rate_text text CHECK(length(rate_text)<=200),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','members','private')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','closed','expired')),
 published_at timestamptz,expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX publications_owner_idx ON public.profile_publications(user_id,created_at DESC);
CREATE INDEX publications_active_idx ON public.profile_publications(published_at DESC,id) WHERE status='active';
CREATE TRIGGER publication_updated BEFORE UPDATE ON public.profile_publications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE public.resume_entitlement_receipts (
 publication_id uuid PRIMARY KEY REFERENCES public.profile_publications(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 entitlement_id uuid NOT NULL REFERENCES public.account_entitlements(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('pro','resume_publication')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.resume_publication_requests (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,request_id uuid NOT NULL,
 publication_id uuid NOT NULL REFERENCES public.profile_publications(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id)
);
CREATE FUNCTION filmverse_private.resume_licensed(p_publication uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.resume_entitlement_receipts r JOIN public.account_entitlements e ON e.id=r.entitlement_id
 WHERE r.publication_id=p_publication AND e.user_id=r.user_id AND e.entitlement_code=r.kind AND e.status='active'
 AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now()))
$$;
CREATE FUNCTION filmverse_private.resume_publish(p_publication uuid,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE publication public.profile_publications; entitlement public.account_entitlements; previous uuid;
BEGIN
 IF auth.uid() IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 -- Serialize every publication attempt for this account, including different
 -- resumes competing for one remaining use. No check-then-write from JS.
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT publication_id INTO previous FROM public.resume_publication_requests WHERE user_id=auth.uid() AND request_id=p_request;
 IF FOUND THEN
   IF previous<>p_publication THEN RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE='22023'; END IF;
   RETURN previous;
 END IF;
 SELECT * INTO publication FROM public.profile_publications WHERE id=p_publication AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'publication_unavailable' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(publication.desired_profession_ids) wanted
 WHERE NOT EXISTS(SELECT 1 FROM public.professions WHERE id=wanted))
 THEN RAISE EXCEPTION 'invalid_profession' USING ERRCODE='22023'; END IF;
 SELECT e.* INTO entitlement FROM public.resume_entitlement_receipts r
 JOIN public.account_entitlements e ON e.id=r.entitlement_id
 WHERE r.publication_id=p_publication AND e.user_id=auth.uid() AND e.status='active'
 AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now()) FOR UPDATE OF e;
 IF NOT FOUND THEN
   SELECT * INTO entitlement FROM public.account_entitlements
   WHERE user_id=auth.uid() AND status='active' AND starts_at<=now() AND (expires_at IS NULL OR expires_at>now())
   AND (entitlement_code='pro' OR (entitlement_code='resume_publication' AND remaining_uses>0))
   ORDER BY (entitlement_code='pro') DESC,expires_at ASC NULLS LAST,id LIMIT 1 FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'resume_entitlement_required' USING ERRCODE='42501'; END IF;
   IF entitlement.entitlement_code='resume_publication' THEN
     UPDATE public.account_entitlements SET remaining_uses=remaining_uses-1 WHERE id=entitlement.id;
   END IF;
   INSERT INTO public.resume_entitlement_receipts(publication_id,user_id,entitlement_id,kind)
   VALUES(p_publication,auth.uid(),entitlement.id,entitlement.entitlement_code)
   ON CONFLICT(publication_id) DO UPDATE SET entitlement_id=EXCLUDED.entitlement_id,kind=EXCLUDED.kind,created_at=now();
 END IF;
 UPDATE public.profile_publications SET status='active',published_at=coalesce(published_at,now()),expires_at=entitlement.expires_at
 WHERE id=p_publication;
 INSERT INTO public.resume_publication_requests(user_id,request_id,publication_id) VALUES(auth.uid(),p_request,p_publication);
 RETURN p_publication;
END $$;
CREATE FUNCTION public.resume_publish(p_publication uuid,p_request uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.resume_publish(p_publication,p_request) $$;
CREATE FUNCTION filmverse_private.resume_transition(p_publication uuid,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_status NOT IN ('paused','closed') THEN RAISE EXCEPTION 'invalid_transition' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 UPDATE public.profile_publications SET status=p_status WHERE id=p_publication AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'publication_unavailable' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.resume_transition(p_publication uuid,p_status text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.resume_transition(p_publication,p_status) $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['profile_publications','resume_entitlement_receipts','resume_publication_requests'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT SELECT ON public.profile_publications TO anon,authenticated;
GRANT INSERT(headline,desired_profession_ids,custom_professions,cities,travel_ready,availability,rate_text,description,visibility),
 UPDATE(headline,desired_profession_ids,custom_professions,cities,travel_ready,availability,rate_text,description,visibility),DELETE
 ON public.profile_publications TO authenticated;
CREATE POLICY resume_read ON public.profile_publications FOR SELECT TO anon,authenticated USING(
 user_id=auth.uid() OR (status='active' AND (expires_at IS NULL OR expires_at>now())
 AND filmverse_private.resume_licensed(id) AND filmverse_private.person_visible(user_id)
 AND (visibility='public' OR (visibility='members' AND auth.uid() IS NOT NULL))));
CREATE POLICY resume_draft ON public.profile_publications FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND status='draft' AND published_at IS NULL);
CREATE POLICY resume_edit ON public.profile_publications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY resume_delete_draft ON public.profile_publications FOR DELETE TO authenticated USING(user_id=auth.uid() AND status='draft' AND published_at IS NULL);
CREATE VIEW public.resume_publications WITH(security_invoker=true) AS
 SELECT id,user_id,headline,desired_profession_ids,custom_professions,cities,travel_ready,availability,rate_text,description,visibility,
 CASE WHEN status='active' AND ((expires_at IS NOT NULL AND expires_at<=now()) OR NOT filmverse_private.resume_licensed(id)) THEN 'expired' ELSE status END AS status,
 published_at,expires_at,created_at,updated_at FROM public.profile_publications;
REVOKE ALL ON public.resume_publications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.resume_publications TO anon,authenticated;
REVOKE ALL ON FUNCTION filmverse_private.resume_licensed(uuid),filmverse_private.resume_publish(uuid,uuid),
 filmverse_private.resume_transition(uuid,text),public.resume_publish(uuid,uuid),public.resume_transition(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.resume_licensed(uuid) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION filmverse_private.resume_publish(uuid,uuid),filmverse_private.resume_transition(uuid,text),
 public.resume_publish(uuid,uuid),public.resume_transition(uuid,text) TO authenticated;
COMMIT;
