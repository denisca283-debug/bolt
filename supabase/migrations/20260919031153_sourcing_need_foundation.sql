BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.project_needs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 180),description text NOT NULL DEFAULT '' CHECK(length(description)<=5000),
 target_type text NOT NULL CHECK(target_type IN ('person','casting_subject','organization','equipment','package','location','transport','service','postproduction','other')),
 resolution_route text NOT NULL CHECK(resolution_route IN ('professional_proposal','casting','young_talent_casting','equipment_sourcing','company_rfp','provider_sourcing','manual')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','cancelled')),
 city text,starts_at timestamptz,ends_at timestamptz,quantity int NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 100000),
 budget_minor bigint CHECK(budget_minor>=0),currency text CHECK(currency ~ '^[A-Z]{3}$'),
 constraints jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(constraints)='object' AND octet_length(constraints::text)<=4096),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR starts_at IS NULL OR ends_at>=starts_at),
 CHECK((target_type='casting_subject' AND resolution_route IN ('casting','young_talent_casting')) OR (target_type='person' AND resolution_route='professional_proposal') OR (target_type IN ('equipment','package') AND resolution_route='equipment_sourcing') OR (target_type IN ('organization','postproduction') AND resolution_route='company_rfp') OR (target_type IN ('location','transport','service') AND resolution_route='provider_sourcing') OR (target_type='other' AND resolution_route='manual'))
);
CREATE INDEX project_needs_project_idx ON public.project_needs(project_id,status);
CREATE TABLE public.sourcing_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id),buyer_organization_id uuid REFERENCES public.organizations(id),
 need_id uuid REFERENCES public.project_needs(id),created_by uuid NOT NULL REFERENCES public.profiles(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 180),description text NOT NULL DEFAULT '' CHECK(length(description)<=10000),
 event_type text NOT NULL CHECK(event_type IN ('equipment','standard_service','individual_crew')),
 competition_mode text NOT NULL CHECK(competition_mode IN ('sealed_rfq','sealed_rfp','sealed_person_proposal','reverse_auction','ranked_reverse','direct_quote')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),target_budget_minor bigint CHECK(target_budget_minor>=0),budget_ceiling_minor bigint CHECK(budget_ceiling_minor>0),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','qualification','scheduled','open','evaluation','negotiation','awarded','closed','cancelled')),
 event_version int NOT NULL DEFAULT 1 CHECK(event_version>0),ever_opened boolean NOT NULL DEFAULT false,
 bid_scope text NOT NULL DEFAULT 'whole_event' CHECK(bid_scope IN ('whole_event','lots')),
 buyer_sealed_until_close boolean NOT NULL DEFAULT true,rank_visibility boolean NOT NULL DEFAULT false,price_visibility boolean NOT NULL DEFAULT false,
 participant_visibility text NOT NULL DEFAULT 'hidden' CHECK(participant_visibility='hidden'),
 minimum_decrement_minor bigint NOT NULL DEFAULT 100 CHECK(minimum_decrement_minor>0),
 extension_window_seconds int NOT NULL DEFAULT 120 CHECK(extension_window_seconds BETWEEN 0 AND 600),
 extension_duration_seconds int NOT NULL DEFAULT 120 CHECK(extension_duration_seconds BETWEEN 1 AND 600),
 maximum_extension_seconds int NOT NULL DEFAULT 3600 CHECK(maximum_extension_seconds BETWEEN 0 AND 86400),
 extended_seconds int NOT NULL DEFAULT 0 CHECK(extended_seconds>=0 AND extended_seconds<=maximum_extension_seconds),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at),CHECK(event_type<>'individual_crew' OR (competition_mode='sealed_person_proposal' AND NOT rank_visibility AND NOT price_visibility)),
 CHECK(competition_mode IN ('reverse_auction','ranked_reverse') OR (NOT rank_visibility AND NOT price_visibility))
);
CREATE INDEX sourcing_project_idx ON public.sourcing_events(project_id,status);
CREATE TABLE public.sourcing_lots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.sourcing_events(id),title text NOT NULL CHECK(length(btrim(title)) BETWEEN 2 AND 180),
 specification text NOT NULL DEFAULT '' CHECK(length(specification)<=5000),quantity int NOT NULL DEFAULT 1 CHECK(quantity>0),UNIQUE(event_id,id)
);
CREATE TABLE public.sourcing_participants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.sourcing_events(id),user_id uuid REFERENCES public.profiles(id),organization_id uuid REFERENCES public.organizations(id),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','accepted','qualified','declined','removed')),acknowledged_version int NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),CHECK((user_id IS NOT NULL)::int+(organization_id IS NOT NULL)::int=1),UNIQUE(event_id,user_id),UNIQUE(event_id,organization_id),UNIQUE(event_id,id)
);
CREATE TABLE public.sourcing_bids(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.sourcing_events(id),participant_id uuid NOT NULL,lot_id uuid,
 event_version int NOT NULL,revision int NOT NULL CHECK(revision>0),amount_minor bigint NOT NULL CHECK(amount_minor>0),
 submitted_by uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(event_id,participant_id) REFERENCES public.sourcing_participants(event_id,id),
 FOREIGN KEY(event_id,lot_id) REFERENCES public.sourcing_lots(event_id,id),UNIQUE(submitted_by,request_id)
);
CREATE UNIQUE INDEX bid_revision_identity ON public.sourcing_bids(participant_id,coalesce(lot_id,'00000000-0000-0000-0000-000000000000'::uuid),revision);
CREATE INDEX bid_event_time_idx ON public.sourcing_bids(event_id,event_version,submitted_at);
CREATE TABLE public.sourcing_bid_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bid_id uuid NOT NULL REFERENCES public.sourcing_bids(id),position int NOT NULL,
 description text NOT NULL CHECK(length(description) BETWEEN 1 AND 1000),quantity int NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
 unit_price_minor bigint NOT NULL CHECK(unit_price_minor BETWEEN 0 AND 100000000000),UNIQUE(bid_id,position)
);
CREATE TABLE public.sourcing_awards(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.sourcing_events(id),lot_id uuid,bid_id uuid NOT NULL REFERENCES public.sourcing_bids(id),
 method text NOT NULL DEFAULT 'manual_best_value' CHECK(method IN ('manual_best_value','lowest_compliant_bid','multi_factor_manual')),
 rationale text NOT NULL CHECK(length(btrim(rationale)) BETWEEN 10 AND 5000),awarded_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(event_id,lot_id) REFERENCES public.sourcing_lots(event_id,id)
);
CREATE UNIQUE INDEX award_scope_identity ON public.sourcing_awards(event_id,coalesce(lot_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE public.sourcing_rule_notices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.sourcing_events(id),event_version int NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(event_id,event_version)
);
CREATE TABLE public.sourcing_questions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.sourcing_events(id),question text NOT NULL CHECK(length(question) BETWEEN 5 AND 2000),answer text NOT NULL CHECK(length(answer) BETWEEN 1 AND 5000),published_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sourcing_bid_professionals(
 bid_id uuid NOT NULL REFERENCES public.sourcing_bids(id),user_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','confirmation_pending','confirmed','declined')),responded_at timestamptz,PRIMARY KEY(bid_id,user_id)
);
CREATE FUNCTION filmverse_private.sourcing_manage(p_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.sourcing_events e WHERE e.id=p_event AND filmverse_private.project_can(e.project_id) AND (e.buyer_organization_id IS NULL OR filmverse_private.org_can(e.buyer_organization_id,'manage_projects')))
$$;
CREATE FUNCTION filmverse_private.sourcing_party(p_participant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.sourcing_participants p WHERE p.id=p_participant AND p.status NOT IN ('removed','declined') AND (p.user_id=auth.uid() OR filmverse_private.org_can(p.organization_id,'manage_organization')))
$$;
CREATE FUNCTION filmverse_private.sourcing_read(p_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.sourcing_manage(p_event) OR EXISTS(SELECT 1 FROM public.sourcing_participants p WHERE p.event_id=p_event AND filmverse_private.sourcing_party(p.id))
$$;
CREATE FUNCTION filmverse_private.sourcing_bid_read(p_bid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sourcing_bids b JOIN public.sourcing_events e ON e.id=b.event_id WHERE b.id=p_bid AND
 (filmverse_private.sourcing_party(b.participant_id) OR (filmverse_private.sourcing_manage(e.id) AND (NOT e.buyer_sealed_until_close OR clock_timestamp()>=e.ends_at))))
$$;
CREATE FUNCTION filmverse_private.sourcing_create(p_project uuid,p_need uuid,p_rules jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; org uuid;
BEGIN
 IF NOT filmverse_private.project_can(p_project) THEN RAISE EXCEPTION 'project_authority_required' USING ERRCODE='42501';END IF;
 IF p_rules IS NULL OR jsonb_typeof(p_rules)<>'object' OR octet_length(p_rules::text)>16000 THEN RAISE EXCEPTION 'invalid_rules' USING ERRCODE='22023';END IF;
 SELECT organization_id INTO org FROM public.projects WHERE id=p_project;
 IF p_need IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_needs WHERE id=p_need AND project_id=p_project AND ((target_type='person' AND p_rules->>'event_type'='individual_crew' AND p_rules->>'competition_mode'='sealed_person_proposal') OR (target_type IN ('equipment','package') AND p_rules->>'event_type'='equipment') OR (target_type IN ('organization','postproduction','location','transport','service') AND p_rules->>'event_type'='standard_service'))) THEN RAISE EXCEPTION 'casting_is_not_sourcing' USING ERRCODE='23514';END IF;
 INSERT INTO public.sourcing_events(project_id,buyer_organization_id,need_id,created_by,title,description,event_type,competition_mode,currency,target_budget_minor,budget_ceiling_minor,starts_at,ends_at,bid_scope,buyer_sealed_until_close,rank_visibility,price_visibility,minimum_decrement_minor,extension_window_seconds,extension_duration_seconds,maximum_extension_seconds)
 VALUES(p_project,org,p_need,auth.uid(),p_rules->>'title',coalesce(p_rules->>'description',''),p_rules->>'event_type',p_rules->>'competition_mode',p_rules->>'currency',
 (p_rules->>'target_budget_minor')::bigint,(p_rules->>'budget_ceiling_minor')::bigint,(p_rules->>'starts_at')::timestamptz,(p_rules->>'ends_at')::timestamptz,coalesce(p_rules->>'bid_scope','whole_event'),coalesce((p_rules->>'buyer_sealed_until_close')::boolean,true),coalesce((p_rules->>'rank_visibility')::boolean,false),coalesce((p_rules->>'price_visibility')::boolean,false),coalesce((p_rules->>'minimum_decrement_minor')::bigint,100),coalesce((p_rules->>'extension_window_seconds')::int,120),coalesce((p_rules->>'extension_duration_seconds')::int,120),coalesce((p_rules->>'maximum_extension_seconds')::int,3600)) RETURNING id INTO result;RETURN result;
END $$;
CREATE FUNCTION filmverse_private.sourcing_invite(p_event uuid,p_user uuid,p_org uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sourcing_events; result uuid;
BEGIN
 SELECT * INTO e FROM public.sourcing_events WHERE id=p_event FOR UPDATE;
 IF NOT filmverse_private.sourcing_manage(p_event) OR e.status NOT IN ('draft','qualification','scheduled') THEN RAISE EXCEPTION 'invitation_unavailable' USING ERRCODE='42501';END IF;
 IF (p_user IS NOT NULL)::int+(p_org IS NOT NULL)::int<>1 OR (p_user IS NOT NULL AND (p_user=e.created_by OR NOT filmverse_private.person_contactable(p_user,'invite'))) OR (p_org IS NOT NULL AND (p_org=e.buyer_organization_id OR NOT filmverse_private.org_public(p_org))) OR (e.event_type='individual_crew' AND p_org IS NOT NULL) THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.sourcing_participants(event_id,user_id,organization_id) VALUES(p_event,p_user,p_org) RETURNING id INTO result;RETURN result;
END $$;
CREATE FUNCTION filmverse_private.sourcing_participant_decide(p_participant uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.sourcing_participants; e public.sourcing_events;
BEGIN
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant;
 SELECT * INTO e FROM public.sourcing_events WHERE id=p.event_id FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant;
 IF p_action='accept' AND filmverse_private.sourcing_party(p.id) AND p.status IN ('invited','accepted','qualified') THEN UPDATE public.sourcing_participants SET status=CASE WHEN status='qualified' THEN status ELSE 'accepted' END,acknowledged_version=e.event_version WHERE id=p.id;
 ELSIF p_action='decline' AND filmverse_private.sourcing_party(p.id) THEN UPDATE public.sourcing_participants SET status='declined' WHERE id=p.id;
 ELSIF p_action='qualify' AND filmverse_private.sourcing_manage(e.id) AND p.status='accepted' THEN UPDATE public.sourcing_participants SET status='qualified' WHERE id=p.id;
 ELSIF p_action='remove' AND filmverse_private.sourcing_manage(e.id) THEN UPDATE public.sourcing_participants SET status='removed' WHERE id=p.id;
 ELSE RAISE EXCEPTION 'participant_action_denied' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION filmverse_private.sourcing_open(p_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sourcing_events;
BEGIN
 SELECT * INTO e FROM public.sourcing_events WHERE id=p_event FOR UPDATE;
 IF NOT filmverse_private.sourcing_manage(p_event) THEN RAISE EXCEPTION 'buyer_authority_required' USING ERRCODE='42501';END IF;
 IF e.status NOT IN ('draft','qualification','scheduled') OR clock_timestamp()>=e.ends_at OR EXISTS(SELECT 1 FROM public.sourcing_participants WHERE event_id=e.id AND status='qualified' AND acknowledged_version<>e.event_version) OR NOT EXISTS(SELECT 1 FROM public.sourcing_participants WHERE event_id=e.id AND status='qualified') THEN RAISE EXCEPTION 'qualified_acknowledged_participants_required' USING ERRCODE='23514';END IF;
 UPDATE public.sourcing_events SET status='open',ever_opened=true WHERE id=e.id;
END $$;
CREATE FUNCTION filmverse_private.sourcing_revise(p_event uuid,p_description text,p_ends timestamptz,p_ceiling bigint,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sourcing_events;
BEGIN
 SELECT * INTO e FROM public.sourcing_events WHERE id=p_event FOR UPDATE;
 IF NOT filmverse_private.sourcing_manage(p_event) THEN RAISE EXCEPTION 'buyer_authority_required' USING ERRCODE='42501';END IF;
 IF e.status IN ('awarded','closed','cancelled') OR p_ends IS NULL OR p_ends<=clock_timestamp() OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'material_change_requires_reason_and_reopen' USING ERRCODE='23514';END IF;
 UPDATE public.sourcing_events SET description=p_description,ends_at=p_ends,budget_ceiling_minor=p_ceiling,event_version=event_version+1,status='qualification',extended_seconds=0 WHERE id=e.id;
 INSERT INTO public.sourcing_rule_notices(event_id,event_version,reason) VALUES(e.id,e.event_version+1,p_reason);
END $$;
CREATE FUNCTION filmverse_private.sourcing_bid_submit(p_event uuid,p_participant uuid,p_lot uuid,p_request uuid,p_items jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sourcing_events;p public.sourcing_participants;existing public.sourcing_bids;total bigint;best bigint;result uuid;rev int;extra int; stamp timestamptz;
BEGIN
 SELECT * INTO e FROM public.sourcing_events WHERE id=p_event FOR UPDATE;
 IF e.id IS NULL OR NOT filmverse_private.sourcing_party(p_participant) THEN RAISE EXCEPTION 'participant_authority_required' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant AND event_id=e.id;
 IF p.id IS NULL THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 IF p_request IS NULL OR p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 OR octet_length(p_items::text)>50000 THEN RAISE EXCEPTION 'invalid_bid_items' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE jsonb_typeof(i)<>'object' OR NOT(i?'description' AND i?'quantity' AND i?'unit_price_minor') OR (SELECT count(*) FROM jsonb_object_keys(i))<>3 OR length(i->>'description') NOT BETWEEN 1 AND 1000 OR (i->>'quantity')::int NOT BETWEEN 1 AND 100000 OR (i->>'unit_price_minor')::bigint NOT BETWEEN 0 AND 100000000000) THEN RAISE EXCEPTION 'invalid_bid_item' USING ERRCODE='22023';END IF;
 SELECT sum((i->>'quantity')::bigint*(i->>'unit_price_minor')::bigint) INTO total FROM jsonb_array_elements(p_items)i;
 SELECT * INTO existing FROM public.sourcing_bids WHERE submitted_by=auth.uid() AND request_id=p_request;
 IF FOUND THEN
 IF (existing.event_id,existing.participant_id,existing.lot_id,existing.amount_minor) IS DISTINCT FROM (e.id,p.id,p_lot,total) OR (SELECT jsonb_agg(jsonb_build_object('description',description,'quantity',quantity,'unit_price_minor',unit_price_minor) ORDER BY position) FROM public.sourcing_bid_items WHERE bid_id=existing.id) IS DISTINCT FROM p_items THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23514';END IF;RETURN existing.id;
 END IF;
 stamp:=clock_timestamp();
 IF p.status<>'qualified' OR p.acknowledged_version<>e.event_version OR e.status<>'open' OR stamp<e.starts_at OR stamp>=e.ends_at THEN RAISE EXCEPTION 'bidding_not_open_or_acknowledged' USING ERRCODE='23514';END IF;
 IF (e.bid_scope='whole_event' AND p_lot IS NOT NULL) OR (e.bid_scope='lots' AND NOT EXISTS(SELECT 1 FROM public.sourcing_lots WHERE id=p_lot AND event_id=e.id)) THEN RAISE EXCEPTION 'bid_scope_mismatch' USING ERRCODE='23514';END IF;
 IF total IS NULL OR total<=0 OR (e.budget_ceiling_minor IS NOT NULL AND total>e.budget_ceiling_minor) THEN RAISE EXCEPTION 'bid_outside_budget' USING ERRCODE='23514';END IF;
 IF e.competition_mode IN ('reverse_auction','ranked_reverse') THEN
 SELECT min(b.amount_minor) INTO best FROM public.sourcing_bids b JOIN public.sourcing_participants sp ON sp.id=b.participant_id AND sp.status='qualified'
 WHERE b.event_id=e.id AND b.event_version=e.event_version AND b.lot_id IS NOT DISTINCT FROM p_lot;
 IF best IS NOT NULL AND total>best-e.minimum_decrement_minor THEN RAISE EXCEPTION 'minimum_decrement_required' USING ERRCODE='23514';END IF;
 END IF;
 SELECT coalesce(max(revision),0)+1 INTO rev FROM public.sourcing_bids WHERE participant_id=p.id AND lot_id IS NOT DISTINCT FROM p_lot;
 INSERT INTO public.sourcing_bids(event_id,participant_id,lot_id,event_version,revision,amount_minor,submitted_by,request_id) VALUES(e.id,p.id,p_lot,e.event_version,rev,total,auth.uid(),p_request) RETURNING id INTO result;
 INSERT INTO public.sourcing_bid_items(bid_id,position,description,quantity,unit_price_minor) SELECT result,n::int,i->>'description',(i->>'quantity')::int,(i->>'unit_price_minor')::bigint FROM jsonb_array_elements(p_items) WITH ORDINALITY a(i,n);
 IF e.competition_mode IN ('reverse_auction','ranked_reverse') AND e.ends_at-stamp<=make_interval(secs=>e.extension_window_seconds) THEN
 extra:=least(e.extension_duration_seconds,e.maximum_extension_seconds-e.extended_seconds);
 UPDATE public.sourcing_events SET ends_at=ends_at+make_interval(secs=>extra),extended_seconds=extended_seconds+extra WHERE id=e.id;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION filmverse_private.sourcing_feedback(p_participant uuid,p_lot uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.sourcing_participants;e public.sourcing_events; own bigint; best bigint;rank bigint;
BEGIN
 IF NOT filmverse_private.sourcing_party(p_participant) THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant;SELECT * INTO e FROM public.sourcing_events WHERE id=p.event_id;
 IF e.competition_mode NOT IN ('reverse_auction','ranked_reverse') THEN RETURN '{}'::jsonb;END IF;
 SELECT amount_minor INTO own FROM public.sourcing_bids WHERE participant_id=p.id AND event_version=e.event_version AND lot_id IS NOT DISTINCT FROM p_lot ORDER BY revision DESC LIMIT 1;
 SELECT min(amount_minor),1+count(DISTINCT participant_id) FILTER(WHERE amount_minor<own) INTO best,rank FROM public.sourcing_bids b WHERE b.event_id=e.id AND b.event_version=e.event_version AND b.lot_id IS NOT DISTINCT FROM p_lot AND EXISTS(SELECT 1 FROM public.sourcing_participants sp WHERE sp.id=b.participant_id AND sp.status='qualified');
 RETURN jsonb_build_object('best_price_minor',CASE WHEN e.price_visibility THEN best END,'rank',CASE WHEN e.rank_visibility AND own IS NOT NULL THEN rank END);
END $$;
CREATE FUNCTION filmverse_private.sourcing_award(p_bid uuid,p_method text,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.sourcing_bids;e public.sourcing_events;result uuid;
BEGIN
 SELECT * INTO b FROM public.sourcing_bids WHERE id=p_bid;SELECT * INTO e FROM public.sourcing_events WHERE id=b.event_id FOR UPDATE;
 IF NOT filmverse_private.sourcing_manage(e.id) THEN RAISE EXCEPTION 'buyer_authority_required' USING ERRCODE='42501';END IF;
 IF e.id IS NULL OR clock_timestamp()<e.ends_at OR e.status NOT IN ('open','evaluation','negotiation','awarded') OR b.event_version<>e.event_version
 OR NOT EXISTS(SELECT 1 FROM public.sourcing_participants WHERE id=b.participant_id AND status='qualified')
 OR EXISTS(SELECT 1 FROM public.sourcing_bids newer WHERE newer.participant_id=b.participant_id AND newer.lot_id IS NOT DISTINCT FROM b.lot_id AND newer.revision>b.revision)
 OR EXISTS(SELECT 1 FROM public.sourcing_bid_professionals WHERE bid_id=b.id AND status<>'confirmed') THEN RAISE EXCEPTION 'award_not_eligible' USING ERRCODE='23514';END IF;
 IF p_method='lowest_compliant_bid' AND EXISTS(SELECT 1 FROM public.sourcing_bids rival JOIN public.sourcing_participants sp ON sp.id=rival.participant_id AND sp.status='qualified' WHERE rival.event_id=e.id AND rival.event_version=e.event_version AND rival.lot_id IS NOT DISTINCT FROM b.lot_id AND rival.amount_minor<b.amount_minor AND NOT EXISTS(SELECT 1 FROM public.sourcing_bid_professionals consent WHERE consent.bid_id=rival.id AND consent.status<>'confirmed') AND NOT EXISTS(SELECT 1 FROM public.sourcing_bids newer WHERE newer.participant_id=rival.participant_id AND newer.lot_id IS NOT DISTINCT FROM rival.lot_id AND newer.revision>rival.revision)) THEN RAISE EXCEPTION 'lower_compliant_bid_exists' USING ERRCODE='23514';END IF;
 INSERT INTO public.sourcing_awards(event_id,lot_id,bid_id,method,rationale,awarded_by) VALUES(e.id,b.lot_id,b.id,p_method,p_reason,auth.uid()) RETURNING id INTO result;
 UPDATE public.sourcing_events SET status='awarded' WHERE id=e.id;RETURN result;
END $$;
CREATE TRIGGER sourcing_bid_immutable BEFORE UPDATE OR DELETE ON public.sourcing_bids FOR EACH ROW EXECUTE FUNCTION filmverse_private.ledger_immutable();
CREATE TRIGGER sourcing_bid_item_immutable BEFORE UPDATE OR DELETE ON public.sourcing_bid_items FOR EACH ROW EXECUTE FUNCTION filmverse_private.ledger_immutable();
CREATE TRIGGER sourcing_award_immutable BEFORE UPDATE OR DELETE ON public.sourcing_awards FOR EACH ROW EXECUTE FUNCTION filmverse_private.ledger_immutable();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['project_needs','sourcing_events','sourcing_lots','sourcing_participants','sourcing_bids','sourcing_bid_items','sourcing_awards','sourcing_rule_notices','sourcing_questions','sourcing_bid_professionals'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);EXECUTE format('GRANT ALL ON public.%I TO service_role',t);END LOOP;
END $$;
GRANT SELECT,INSERT(project_id,title,description,target_type,resolution_route,city,starts_at,ends_at,quantity,budget_minor,currency,constraints),UPDATE(title,description,status,city,starts_at,ends_at,quantity,budget_minor,currency,constraints) ON public.project_needs TO authenticated;
CREATE POLICY need_read ON public.project_needs FOR SELECT TO authenticated USING(filmverse_private.project_collaborator(project_id));
CREATE POLICY need_create ON public.project_needs FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND filmverse_private.project_can(project_id));
CREATE POLICY need_edit ON public.project_needs FOR UPDATE TO authenticated USING(filmverse_private.project_can(project_id)) WITH CHECK(filmverse_private.project_can(project_id));
-- Private target budget is absent from browser grants. Ceiling is a predeclared bidding rule, not a secret oracle.
GRANT SELECT(id,project_id,buyer_organization_id,need_id,title,description,event_type,competition_mode,currency,budget_ceiling_minor,starts_at,ends_at,status,event_version,bid_scope,buyer_sealed_until_close,rank_visibility,price_visibility,participant_visibility,minimum_decrement_minor,extension_window_seconds,extension_duration_seconds,maximum_extension_seconds,extended_seconds,created_at) ON public.sourcing_events TO authenticated;
CREATE POLICY event_parties ON public.sourcing_events FOR SELECT TO authenticated USING(filmverse_private.sourcing_read(id));
GRANT SELECT ON public.sourcing_lots,public.sourcing_participants,public.sourcing_bids,public.sourcing_bid_items,public.sourcing_awards,public.sourcing_rule_notices,public.sourcing_questions TO authenticated;
GRANT INSERT(event_id,title,specification,quantity),UPDATE(title,specification,quantity),DELETE ON public.sourcing_lots TO authenticated;
CREATE POLICY lot_read ON public.sourcing_lots FOR SELECT TO authenticated USING(filmverse_private.sourcing_read(event_id));
CREATE FUNCTION filmverse_private.sourcing_lot_editable(p_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.sourcing_manage(p_event) AND EXISTS(SELECT 1 FROM public.sourcing_events WHERE id=p_event AND NOT ever_opened AND bid_scope='lots' AND status IN ('draft','qualification'))
$$;
CREATE FUNCTION filmverse_private.sourcing_lot_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE eid uuid;
BEGIN eid:=CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END;
 PERFORM 1 FROM public.sourcing_events WHERE id=eid FOR UPDATE;
 IF NOT filmverse_private.sourcing_lot_editable(eid) THEN RAISE EXCEPTION 'lot_rules_locked' USING ERRCODE='42501';END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER sourcing_lot_lock BEFORE INSERT OR UPDATE OR DELETE ON public.sourcing_lots FOR EACH ROW EXECUTE FUNCTION filmverse_private.sourcing_lot_guard();
REVOKE ALL ON FUNCTION filmverse_private.sourcing_lot_guard() FROM PUBLIC,anon,authenticated;
CREATE POLICY lot_create ON public.sourcing_lots FOR INSERT TO authenticated WITH CHECK(filmverse_private.sourcing_lot_editable(event_id));
CREATE POLICY lot_edit ON public.sourcing_lots FOR UPDATE TO authenticated USING(filmverse_private.sourcing_lot_editable(event_id)) WITH CHECK(filmverse_private.sourcing_lot_editable(event_id));
CREATE POLICY lot_remove ON public.sourcing_lots FOR DELETE TO authenticated USING(filmverse_private.sourcing_lot_editable(event_id));
CREATE POLICY participant_read ON public.sourcing_participants FOR SELECT TO authenticated USING(filmverse_private.sourcing_manage(event_id) OR filmverse_private.sourcing_party(id));
CREATE POLICY bid_read ON public.sourcing_bids FOR SELECT TO authenticated USING(filmverse_private.sourcing_bid_read(id));
CREATE POLICY bid_item_read ON public.sourcing_bid_items FOR SELECT TO authenticated USING(filmverse_private.sourcing_bid_read(bid_id));
CREATE POLICY award_read ON public.sourcing_awards FOR SELECT TO authenticated USING(filmverse_private.sourcing_manage(event_id) OR filmverse_private.sourcing_bid_read(bid_id));
CREATE POLICY notice_read ON public.sourcing_rule_notices FOR SELECT TO authenticated USING(filmverse_private.sourcing_read(event_id));
CREATE POLICY question_read ON public.sourcing_questions FOR SELECT TO authenticated USING(filmverse_private.sourcing_read(event_id));
GRANT INSERT(event_id,question,answer) ON public.sourcing_questions TO authenticated;
CREATE POLICY question_publish ON public.sourcing_questions FOR INSERT TO authenticated WITH CHECK(published_by=auth.uid() AND filmverse_private.sourcing_manage(event_id));
-- Bid-person commercial consent remains server-managed until the person can inspect a scoped proposal.
-- No supplier may manufacture confirmed consent from the browser.

CREATE FUNCTION public.sourcing_create(p_project uuid,p_need uuid,p_rules jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_create(p_project,p_need,p_rules) $$;
CREATE FUNCTION public.sourcing_invite(p_event uuid,p_user uuid,p_org uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_invite(p_event,p_user,p_org) $$;
CREATE FUNCTION public.sourcing_participant_decide(p_participant uuid,p_action text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_participant_decide(p_participant,p_action) $$;
CREATE FUNCTION public.sourcing_open(p_event uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_open(p_event) $$;
CREATE FUNCTION public.sourcing_revise(p_event uuid,p_description text,p_ends timestamptz,p_ceiling bigint,p_reason text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_revise(p_event,p_description,p_ends,p_ceiling,p_reason) $$;
CREATE FUNCTION public.sourcing_bid_submit(p_event uuid,p_participant uuid,p_lot uuid,p_request uuid,p_items jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_bid_submit(p_event,p_participant,p_lot,p_request,p_items) $$;
CREATE FUNCTION public.sourcing_feedback(p_participant uuid,p_lot uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_feedback(p_participant,p_lot) $$;
CREATE FUNCTION public.sourcing_award(p_bid uuid,p_method text,p_reason text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_award(p_bid,p_method,p_reason) $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','filmverse_private') AND p.proname=ANY(ARRAY['sourcing_manage','sourcing_party','sourcing_read','sourcing_bid_read','sourcing_create','sourcing_invite','sourcing_participant_decide','sourcing_open','sourcing_revise','sourcing_bid_submit','sourcing_feedback','sourcing_award','sourcing_lot_editable']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END LOOP;
END $$;
COMMIT;
