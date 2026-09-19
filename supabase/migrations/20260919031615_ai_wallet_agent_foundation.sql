BEGIN;
SET LOCAL lock_timeout='5s';
INSERT INTO public.organization_role_permissions(role_key,permission) VALUES('owner','use_ai'),('admin','use_ai'),('producer','use_ai') ON CONFLICT DO NOTHING;
CREATE TABLE public.ai_operation_catalog(
 operation_code text PRIMARY KEY CHECK(operation_code ~ '^[a-z][a-z0-9_.]{2,80}$'),credit_cost bigint NOT NULL CHECK(credit_cost BETWEEN 0 AND 1000000),
 tier text NOT NULL CHECK(tier IN ('lightweight','premium')),enabled boolean NOT NULL DEFAULT false,version int NOT NULL DEFAULT 1 CHECK(version>0),
 estimated_infrastructure_cost numeric(12,6) CHECK(estimated_infrastructure_cost>=0)
);
INSERT INTO public.ai_operation_catalog(operation_code,credit_cost,tier,enabled) VALUES
 ('filters.parse',1,'lightweight',false),('candidate.explain',1,'lightweight',false),('project.analyze_needs',2,'lightweight',false),
 ('crew.build',20,'premium',false),('casting.search',10,'premium',false),('equipment.package',10,'premium',false),('budget.optimize',15,'premium',false),('sourcing.compare',10,'premium',false);
CREATE TABLE public.ai_allowance_policy(
 id boolean PRIMARY KEY DEFAULT true CHECK(id),welcome_credits bigint NOT NULL CHECK(welcome_credits BETWEEN 0 AND 10000),
 monthly_free_credits bigint NOT NULL CHECK(monthly_free_credits BETWEEN 0 AND 10000),enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.ai_allowance_policy VALUES(true,5,3,false);
CREATE TABLE public.ai_wallets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE REFERENCES public.profiles(id),organization_id uuid UNIQUE REFERENCES public.organizations(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((user_id IS NOT NULL)::int+(organization_id IS NOT NULL)::int=1)
);
CREATE TABLE public.ai_usage_operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wallet_id uuid NOT NULL REFERENCES public.ai_wallets(id),initiating_user uuid NOT NULL REFERENCES public.profiles(id),project_id uuid NOT NULL REFERENCES public.projects(id),
 operation_code text NOT NULL REFERENCES public.ai_operation_catalog(operation_code),catalog_version int NOT NULL,credits bigint NOT NULL CHECK(credits>=0),
 estimated_infrastructure_cost numeric(12,6),request_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(wallet_id,request_id)
);
CREATE TABLE public.ai_credit_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wallet_id uuid NOT NULL REFERENCES public.ai_wallets(id),
 entry_type text NOT NULL CHECK(entry_type IN ('grant','monthly_allowance','bonus','usage','topup','refund','adjustment')),
 credits bigint NOT NULL CHECK(credits<>0),reference text NOT NULL CHECK(length(reference) BETWEEN 3 AND 200),
 operation_id uuid REFERENCES public.ai_usage_operations(id),reverses_id uuid UNIQUE REFERENCES public.ai_credit_ledger(id),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(wallet_id,reference),
 CHECK((entry_type='usage' AND credits<0 AND operation_id IS NOT NULL AND reverses_id IS NULL)
 OR (entry_type='refund' AND credits>0 AND operation_id IS NOT NULL AND reverses_id IS NOT NULL)
 OR (entry_type IN ('grant','monthly_allowance','bonus','topup') AND credits>0 AND reverses_id IS NULL)
 OR (entry_type='adjustment' AND reverses_id IS NULL))
);
CREATE INDEX ai_ledger_wallet_idx ON public.ai_credit_ledger(wallet_id,created_at);
CREATE TRIGGER ai_ledger_immutable BEFORE UPDATE OR DELETE ON public.ai_credit_ledger FOR EACH ROW EXECUTE FUNCTION filmverse_private.ledger_immutable();
CREATE TRIGGER ai_usage_immutable BEFORE UPDATE OR DELETE ON public.ai_usage_operations FOR EACH ROW EXECUTE FUNCTION filmverse_private.ledger_immutable();
CREATE TABLE public.agent_project_memory(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 5000),
 evidence jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(evidence)='array' AND octet_length(evidence::text)<=10000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.agent_action_proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),initiating_user uuid NOT NULL REFERENCES public.profiles(id),
 tool_code text NOT NULL CHECK(tool_code IN ('project.create_need','casting.add_candidate','sourcing.create_draft','messages.draft')),
 arguments jsonb NOT NULL CHECK(jsonb_typeof(arguments)='object' AND octet_length(arguments::text)<=10000),arguments_hash text NOT NULL,
 risk text NOT NULL CHECK(risk IN ('medium','high')),status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','rejected','executed','expired')),
 expires_at timestamptz NOT NULL,approved_by uuid REFERENCES public.profiles(id),approved_at timestamptz,execution_reference uuid,
 created_at timestamptz NOT NULL DEFAULT now(),CHECK(expires_at>created_at),
 CHECK(status NOT IN ('approved','executed') OR (approved_by=initiating_user AND approved_at IS NOT NULL))
);
CREATE FUNCTION filmverse_private.ai_wallet_can(p_wallet uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.ai_wallets WHERE id=p_wallet AND (user_id=auth.uid() OR filmverse_private.org_can(organization_id,'use_ai')))
$$;
CREATE FUNCTION filmverse_private.ai_wallet_open(p_org uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR (p_org IS NOT NULL AND NOT filmverse_private.org_can(p_org,'use_ai')) THEN RAISE EXCEPTION 'wallet_authority_required' USING ERRCODE='42501';END IF;
 IF p_org IS NULL THEN
 INSERT INTO public.ai_wallets(user_id) VALUES(auth.uid()) ON CONFLICT(user_id) DO NOTHING;
 SELECT id INTO result FROM public.ai_wallets WHERE user_id=auth.uid();
 ELSE INSERT INTO public.ai_wallets(organization_id) VALUES(p_org) ON CONFLICT(organization_id) DO NOTHING;
 SELECT id INTO result FROM public.ai_wallets WHERE organization_id=p_org;END IF;RETURN result;
END $$;
CREATE FUNCTION filmverse_private.ai_claim_free(p_wallet uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.ai_wallets;policy public.ai_allowance_policy;period text:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM');
BEGIN
 SELECT * INTO w FROM public.ai_wallets WHERE id=p_wallet FOR UPDATE;
 IF auth.uid() IS NULL OR w.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'personal_wallet_required' USING ERRCODE='42501';END IF;
 SELECT * INTO policy FROM public.ai_allowance_policy WHERE id;
 IF policy.enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'allowance_not_enabled' USING ERRCODE='23514';END IF;
 IF policy.welcome_credits>0 THEN INSERT INTO public.ai_credit_ledger(wallet_id,entry_type,credits,reference) VALUES(w.id,'grant',policy.welcome_credits,'welcome') ON CONFLICT(wallet_id,reference) DO NOTHING;END IF;
 IF policy.monthly_free_credits>0 THEN INSERT INTO public.ai_credit_ledger(wallet_id,entry_type,credits,reference) VALUES(w.id,'monthly_allowance',policy.monthly_free_credits,'free:'||period) ON CONFLICT(wallet_id,reference) DO NOTHING;END IF;
END $$;
CREATE FUNCTION filmverse_private.ai_consume(p_wallet uuid,p_project uuid,p_operation text,p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.ai_wallets;catalog public.ai_operation_catalog;existing public.ai_usage_operations;balance numeric;result uuid;
BEGIN
 SELECT * INTO w FROM public.ai_wallets WHERE id=p_wallet FOR UPDATE;
 IF w.id IS NULL OR NOT filmverse_private.ai_wallet_can(w.id) OR NOT filmverse_private.project_collaborator(p_project) OR
 (w.organization_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p_project AND organization_id=w.organization_id)) THEN RAISE EXCEPTION 'wallet_project_authority_required' USING ERRCODE='42501';END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'request_id_required' USING ERRCODE='22023';END IF;
 SELECT * INTO existing FROM public.ai_usage_operations WHERE wallet_id=w.id AND request_id=p_request;
 IF FOUND THEN IF (existing.project_id,existing.operation_code,existing.initiating_user) IS DISTINCT FROM (p_project,p_operation,auth.uid()) THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23514';END IF;RETURN existing.id;END IF;
 SELECT * INTO catalog FROM public.ai_operation_catalog WHERE operation_code=p_operation AND enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'operation_not_enabled' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(credits),0) INTO balance FROM public.ai_credit_ledger WHERE wallet_id=w.id;
 IF balance<catalog.credit_cost THEN RAISE EXCEPTION 'insufficient_ai_credits' USING ERRCODE='23514';END IF;
 INSERT INTO public.ai_usage_operations(wallet_id,initiating_user,project_id,operation_code,catalog_version,credits,estimated_infrastructure_cost,request_id)
 VALUES(w.id,auth.uid(),p_project,catalog.operation_code,catalog.version,catalog.credit_cost,catalog.estimated_infrastructure_cost,p_request) RETURNING id INTO result;
 IF catalog.credit_cost>0 THEN INSERT INTO public.ai_credit_ledger(wallet_id,entry_type,credits,reference,operation_id) VALUES(w.id,'usage',-catalog.credit_cost,'usage:'||p_request::text,result);END IF;
 RETURN result;
END $$;
-- Trusted billing/worker adapters only. No browser-controlled amount, grant or refund.
CREATE FUNCTION filmverse_private.ai_grant(p_wallet uuid,p_type text,p_credits bigint,p_reference text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.ai_credit_ledger;
BEGIN
 PERFORM 1 FROM public.ai_wallets WHERE id=p_wallet FOR UPDATE;
 IF NOT FOUND OR p_type NOT IN ('grant','monthly_allowance','bonus','topup') OR p_credits IS NULL OR p_credits<=0 OR p_reference IS NULL OR p_reference NOT LIKE 'server:%' THEN RAISE EXCEPTION 'invalid_server_grant' USING ERRCODE='22023';END IF;
 SELECT * INTO old FROM public.ai_credit_ledger WHERE wallet_id=p_wallet AND reference=p_reference;
 IF FOUND THEN IF old.entry_type<>p_type OR old.credits<>p_credits THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23514';END IF;RETURN;END IF;
 INSERT INTO public.ai_credit_ledger(wallet_id,entry_type,credits,reference) VALUES(p_wallet,p_type,p_credits,p_reference);
END $$;
CREATE FUNCTION filmverse_private.ai_refund(p_operation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE usage public.ai_credit_ledger;
BEGIN
 SELECT * INTO usage FROM public.ai_credit_ledger WHERE operation_id=p_operation AND entry_type='usage';
 IF NOT FOUND THEN RAISE EXCEPTION 'usage_not_found' USING ERRCODE='23514';END IF;
 PERFORM 1 FROM public.ai_wallets WHERE id=usage.wallet_id FOR UPDATE;
 INSERT INTO public.ai_credit_ledger(wallet_id,entry_type,credits,reference,operation_id,reverses_id)
 VALUES(usage.wallet_id,'refund',-usage.credits,'refund:'||p_operation::text,p_operation,usage.id) ON CONFLICT(reverses_id) DO NOTHING;
END $$;
CREATE FUNCTION filmverse_private.agent_approve(p_id uuid,p_hash text,p_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE proposal public.agent_action_proposals;
BEGIN
 SELECT * INTO proposal FROM public.agent_action_proposals WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR proposal.initiating_user IS DISTINCT FROM auth.uid() OR NOT filmverse_private.project_can(proposal.project_id) THEN RAISE EXCEPTION 'approval_authority_required' USING ERRCODE='42501';END IF;
 IF proposal.status<>'proposed' OR proposal.expires_at<=clock_timestamp() OR p_approve IS NULL OR proposal.arguments_hash IS DISTINCT FROM p_hash OR proposal.arguments_hash<>encode(sha256(convert_to(proposal.arguments::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'proposal_expired_or_changed' USING ERRCODE='23514';END IF;
 UPDATE public.agent_action_proposals SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,approved_by=auth.uid(),approved_at=now() WHERE id=p_id;
END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['ai_operation_catalog','ai_allowance_policy','ai_wallets','ai_usage_operations','ai_credit_ledger','agent_project_memory','agent_action_proposals'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
GRANT SELECT(operation_code,credit_cost,tier,enabled,version) ON public.ai_operation_catalog TO authenticated;
CREATE POLICY catalog_read ON public.ai_operation_catalog FOR SELECT TO authenticated USING(true);
GRANT SELECT ON public.ai_wallets,public.ai_credit_ledger TO authenticated;
GRANT SELECT(id,wallet_id,initiating_user,project_id,operation_code,catalog_version,credits,request_id,created_at) ON public.ai_usage_operations TO authenticated;
CREATE POLICY wallet_read ON public.ai_wallets FOR SELECT TO authenticated USING(filmverse_private.ai_wallet_can(id));
CREATE POLICY credit_read ON public.ai_credit_ledger FOR SELECT TO authenticated USING(filmverse_private.ai_wallet_can(wallet_id));
CREATE POLICY usage_read ON public.ai_usage_operations FOR SELECT TO authenticated USING(filmverse_private.ai_wallet_can(wallet_id));
GRANT SELECT ON public.agent_project_memory,public.agent_action_proposals TO authenticated;
CREATE POLICY memory_read ON public.agent_project_memory FOR SELECT TO authenticated USING(filmverse_private.project_collaborator(project_id));
CREATE POLICY proposal_read ON public.agent_action_proposals FOR SELECT TO authenticated USING(initiating_user=auth.uid() AND filmverse_private.project_can(project_id));
CREATE FUNCTION public.ai_wallet_open(p_org uuid DEFAULT NULL) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.ai_wallet_open(p_org) $$;
CREATE FUNCTION public.ai_claim_free(p_wallet uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.ai_claim_free(p_wallet) $$;
CREATE FUNCTION public.ai_consume(p_wallet uuid,p_project uuid,p_operation text,p_request uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.ai_consume(p_wallet,p_project,p_operation,p_request) $$;
CREATE FUNCTION public.agent_approve(p_id uuid,p_hash text,p_approve boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.agent_approve(p_id,p_hash,p_approve) $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','filmverse_private') AND p.proname=ANY(ARRAY['ai_wallet_can','ai_wallet_open','ai_claim_free','ai_consume','ai_grant','ai_refund','agent_approve']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF f.proname IN ('ai_grant','ai_refund') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.sig);
 ELSE EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;END LOOP;
END $$;
COMMIT;
