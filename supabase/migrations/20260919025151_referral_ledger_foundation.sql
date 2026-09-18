BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.growth_partners(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_subject_type text NOT NULL CHECK(partner_subject_type IN ('user','organization')),
 user_id uuid REFERENCES public.profiles(id),organization_id uuid REFERENCES public.organizations(id),
 partner_type text NOT NULL CHECK(partner_type IN ('individual','film_school','casting_partner','rental_partner','production_partner','agency_partner','ambassador','other')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','paused','ended')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((partner_subject_type='user' AND user_id IS NOT NULL AND organization_id IS NULL) OR (partner_subject_type='organization' AND organization_id IS NOT NULL AND user_id IS NULL)),
 UNIQUE(user_id),UNIQUE(organization_id)
);
CREATE TABLE public.referral_reward_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reward_type text NOT NULL CHECK(reward_type IN ('ai_credits','pro_days','publication_credits','promotion_credits','tender_credits','platform_credits','cash_future')),
 partner_value bigint NOT NULL CHECK(partner_value BETWEEN 0 AND 1000000),new_user_value bigint NOT NULL DEFAULT 0 CHECK(new_user_value BETWEEN 0 AND 1000000),
 qualifying_event text NOT NULL CHECK(qualifying_event IN ('profile_completed','first_application','first_project_created','first_work_posted','first_company_created')),
 enabled boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.referral_campaigns(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid NOT NULL REFERENCES public.growth_partners(id),name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160),
 campaign_type text NOT NULL CHECK(campaign_type IN ('individual','cohort','casting','rental','production','agency','other')),
 destination_path text NOT NULL CHECK(destination_path ~ '^/(work|projects|students|industry|education|events|companies|actors|models)(/[a-zA-Z0-9_-]+)?$'),
 reward_rule_id uuid REFERENCES public.referral_reward_rules(id),starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','ended')),created_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at)
);
CREATE TABLE public.referral_codes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),campaign_id uuid NOT NULL REFERENCES public.referral_campaigns(id),
 code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-','') CHECK(code ~ '^[a-zA-Z0-9_-]{16,80}$'),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.referral_attributions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),new_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
 referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),first_touch_at timestamptz NOT NULL DEFAULT now(),qualified_at timestamptz,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','qualified','rejected','reversed'))
);
CREATE TABLE public.referral_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attribution_id uuid NOT NULL REFERENCES public.referral_attributions(id),
 event_type text NOT NULL CHECK(event_type IN ('profile_completed','first_application','first_project_created','first_work_posted','first_company_created')),
 source_reference text NOT NULL UNIQUE CHECK(length(source_reference) BETWEEN 5 AND 200),
 status text NOT NULL DEFAULT 'qualified' CHECK(status IN ('qualified','cancelled')),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(attribution_id,event_type)
);
CREATE TABLE public.referral_reward_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),partner_id uuid NOT NULL REFERENCES public.growth_partners(id),referred_user_id uuid NOT NULL REFERENCES public.profiles(id),
 event_id uuid NOT NULL REFERENCES public.referral_events(id),reward_type text NOT NULL CHECK(reward_type IN ('ai_credits','pro_days','publication_credits','promotion_credits','tender_credits','platform_credits')),
 beneficiary text NOT NULL CHECK(beneficiary IN ('partner','referred_user')),value bigint NOT NULL CHECK(value<>0),
 status text NOT NULL CHECK(status IN ('approved','reversed')),idempotency_reference text NOT NULL UNIQUE,
 reverses_id uuid UNIQUE REFERENCES public.referral_reward_ledger(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='approved' AND value>0 AND reverses_id IS NULL) OR (status='reversed' AND value<0 AND reverses_id IS NOT NULL))
);
CREATE UNIQUE INDEX reward_once_per_account_type ON public.referral_reward_ledger(referred_user_id,reward_type,beneficiary) WHERE status='approved';
CREATE FUNCTION filmverse_private.ledger_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'append_only_ledger' USING ERRCODE='42501';END $$;
CREATE TRIGGER referral_immutable BEFORE UPDATE OR DELETE ON public.referral_reward_ledger FOR EACH ROW EXECUTE FUNCTION filmverse_private.ledger_immutable();
CREATE FUNCTION filmverse_private.partner_can(p_partner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.growth_partners WHERE id=p_partner AND (user_id=auth.uid() OR filmverse_private.org_can(organization_id,'manage_organization')))
$$;
CREATE FUNCTION filmverse_private.referral_resolve(p_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('destination_path',c.destination_path,'campaign_name',c.name)
 FROM public.referral_codes k JOIN public.referral_campaigns c ON c.id=k.campaign_id JOIN public.growth_partners p ON p.id=c.partner_id
 WHERE k.code=p_code AND k.status='active' AND c.status='active' AND p.status='active' AND now()>=c.starts_at AND now()<c.ends_at
$$;
CREATE FUNCTION filmverse_private.referral_attribute(p_code text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k uuid; partner_user uuid; partner_org uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT codes.id,p.user_id,p.organization_id INTO k,partner_user,partner_org FROM public.referral_codes codes JOIN public.referral_campaigns c ON c.id=codes.campaign_id JOIN public.growth_partners p ON p.id=c.partner_id WHERE codes.code=p_code AND codes.status='active' AND c.status='active' AND p.status='active' AND now() BETWEEN c.starts_at AND c.ends_at;
 IF k IS NULL OR partner_user=auth.uid() OR EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=partner_org AND m.user_id=auth.uid() AND m.active) THEN RAISE EXCEPTION 'referral_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.referral_attributions(new_user_id,referral_code_id) VALUES(auth.uid(),k) ON CONFLICT(new_user_id) DO NOTHING;
END $$;
-- Trusted activation ingress only. Never granted to browser roles, even for a partner.
CREATE FUNCTION filmverse_private.referral_qualify(p_attribution uuid,p_event text,p_reference text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.referral_attributions; c public.referral_campaigns; p public.growth_partners; rule public.referral_reward_rules; event uuid;
BEGIN
 SELECT * INTO a FROM public.referral_attributions WHERE id=p_attribution FOR UPDATE;
 IF NOT FOUND OR a.status IN ('rejected','reversed') THEN RAISE EXCEPTION 'attribution_unavailable' USING ERRCODE='23514';END IF;
 SELECT campaigns.* INTO c FROM public.referral_campaigns campaigns JOIN public.referral_codes codes ON codes.campaign_id=campaigns.id WHERE codes.id=a.referral_code_id AND codes.status='active';
 SELECT * INTO p FROM public.growth_partners WHERE id=c.partner_id;
 SELECT * INTO rule FROM public.referral_reward_rules WHERE id=c.reward_rule_id;
 IF c.status IS DISTINCT FROM 'active' OR p.status IS DISTINCT FROM 'active' OR now()<c.starts_at OR now()>=c.ends_at OR rule.enabled IS DISTINCT FROM true OR rule.qualifying_event IS DISTINCT FROM p_event OR rule.reward_type='cash_future'
 OR p.user_id=a.new_user_id OR EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=p.organization_id AND user_id=a.new_user_id AND active) THEN RAISE EXCEPTION 'reward_not_eligible' USING ERRCODE='23514';END IF;
 INSERT INTO public.referral_events(attribution_id,event_type,source_reference) VALUES(a.id,p_event,p_reference) ON CONFLICT(attribution_id,event_type) DO NOTHING RETURNING id INTO event;
 IF event IS NULL THEN SELECT id INTO event FROM public.referral_events WHERE attribution_id=a.id AND event_type=p_event AND source_reference=p_reference AND status='qualified';
 IF event IS NULL THEN RAISE EXCEPTION 'conflicting_activation' USING ERRCODE='23514';END IF;RETURN event;END IF;
 IF rule.partner_value>0 THEN INSERT INTO public.referral_reward_ledger(partner_id,referred_user_id,event_id,reward_type,beneficiary,value,status,idempotency_reference) VALUES(p.id,a.new_user_id,event,rule.reward_type,'partner',rule.partner_value,'approved',event::text||':partner');END IF;
 IF rule.new_user_value>0 THEN INSERT INTO public.referral_reward_ledger(partner_id,referred_user_id,event_id,reward_type,beneficiary,value,status,idempotency_reference) VALUES(p.id,a.new_user_id,event,rule.reward_type,'referred_user',rule.new_user_value,'approved',event::text||':referred_user');END IF;
 UPDATE public.referral_attributions SET status='qualified',qualified_at=now() WHERE id=a.id;RETURN event;
END $$;
CREATE FUNCTION filmverse_private.referral_reverse(p_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.referral_events WHERE id=p_event FOR UPDATE;
 UPDATE public.referral_events SET status='cancelled' WHERE id=p_event;
 INSERT INTO public.referral_reward_ledger(partner_id,referred_user_id,event_id,reward_type,beneficiary,value,status,idempotency_reference,reverses_id)
 SELECT partner_id,referred_user_id,event_id,reward_type,beneficiary,-value,'reversed','reversal:'||id::text,id FROM public.referral_reward_ledger WHERE event_id=p_event AND status='approved' ON CONFLICT(reverses_id) DO NOTHING;
 UPDATE public.referral_attributions SET status='reversed' WHERE id=(SELECT attribution_id FROM public.referral_events WHERE id=p_event);
END $$;
CREATE FUNCTION filmverse_private.referral_dashboard(p_partner uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT filmverse_private.partner_can(p_partner) THEN RAISE EXCEPTION 'partner_unavailable' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('signups',(SELECT count(*) FROM public.referral_attributions a JOIN public.referral_codes k ON k.id=a.referral_code_id JOIN public.referral_campaigns c ON c.id=k.campaign_id WHERE c.partner_id=p_partner),
 'qualified',(SELECT count(*) FROM public.referral_attributions a JOIN public.referral_codes k ON k.id=a.referral_code_id JOIN public.referral_campaigns c ON c.id=k.campaign_id WHERE c.partner_id=p_partner AND a.status='qualified'),
 'rewards',(SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM(SELECT reward_type,sum(value) AS approved_credits FROM public.referral_reward_ledger WHERE partner_id=p_partner AND beneficiary='partner' GROUP BY reward_type)r));
END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['growth_partners','referral_reward_rules','referral_campaigns','referral_codes','referral_attributions','referral_events','referral_reward_ledger'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
GRANT SELECT ON public.growth_partners,public.referral_campaigns,public.referral_codes TO authenticated;
CREATE POLICY partner_read ON public.growth_partners FOR SELECT TO authenticated USING(filmverse_private.partner_can(id));
CREATE POLICY campaign_read ON public.referral_campaigns FOR SELECT TO authenticated USING(filmverse_private.partner_can(partner_id));
CREATE POLICY code_read ON public.referral_codes FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.referral_campaigns WHERE id=campaign_id AND filmverse_private.partner_can(partner_id)));
CREATE FUNCTION public.referral_resolve(p_code text) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.referral_resolve(p_code) $$;
CREATE FUNCTION public.referral_attribute(p_code text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.referral_attribute(p_code) $$;
CREATE FUNCTION public.referral_dashboard(p_partner uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.referral_dashboard(p_partner) $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','filmverse_private') AND p.proname=ANY(ARRAY['ledger_immutable','partner_can','referral_resolve','referral_attribute','referral_qualify','referral_reverse','referral_dashboard']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF f.proname IN ('referral_qualify','referral_reverse') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
 ELSIF f.proname<>'ledger_immutable' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 IF f.proname='referral_resolve' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.sig);END IF;END LOOP;
END $$;
COMMIT;
