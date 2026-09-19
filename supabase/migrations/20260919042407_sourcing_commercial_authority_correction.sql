BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.project_sourcing_authorities(
 project_id uuid NOT NULL REFERENCES public.projects(id),user_id uuid NOT NULL REFERENCES public.profiles(id),
 permission text NOT NULL CHECK(permission IN ('view_sourcing','manage_sourcing','invite_sourcing_participants','evaluate_bids','award_sourcing')),
 granted_by uuid NOT NULL REFERENCES public.profiles(id),granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 PRIMARY KEY(project_id,user_id,permission)
);
CREATE TABLE public.organization_sourcing_authorities(
 organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES public.profiles(id),
 permission text NOT NULL CHECK(permission IN ('view_sourcing','prepare_bid','submit_bid')),
 granted_by uuid NOT NULL REFERENCES public.profiles(id),granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,
 PRIMARY KEY(organization_id,user_id,permission)
);
CREATE FUNCTION filmverse_private.project_sourcing_can(p_project uuid,p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND p_permission IN ('view_sourcing','manage_sourcing','invite_sourcing_participants','evaluate_bids','award_sourcing')
 AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_project AND
 ((p.organization_id IS NULL AND p.user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=p.organization_id AND m.user_id=auth.uid() AND m.active AND m.role='owner')
 OR EXISTS(SELECT 1 FROM public.project_sourcing_authorities a JOIN public.project_members m ON m.project_id=a.project_id AND m.user_id=a.user_id AND m.status='active'
 WHERE a.project_id=p.id AND a.user_id=auth.uid() AND a.revoked_at IS NULL AND (a.permission=p_permission OR p_permission='view_sourcing'))))
$$;
CREATE FUNCTION filmverse_private.provider_sourcing_can(p_org uuid,p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND p_permission IN ('view_sourcing','prepare_bid','submit_bid') AND EXISTS(
 SELECT 1 FROM public.organization_members m WHERE m.organization_id=p_org AND m.user_id=auth.uid() AND m.active
 AND (m.role='owner' OR EXISTS(SELECT 1 FROM public.organization_sourcing_authorities a WHERE a.organization_id=p_org AND a.user_id=auth.uid() AND a.revoked_at IS NULL
 AND (a.permission=p_permission OR p_permission='view_sourcing'))))
$$;
CREATE FUNCTION filmverse_private.sourcing_can(p_event uuid,p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sourcing_events WHERE id=p_event AND filmverse_private.project_sourcing_can(project_id,p_permission))
$$;
CREATE FUNCTION filmverse_private.sourcing_participant_can(p_participant uuid,p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND p_permission IN ('view_sourcing','prepare_bid','submit_bid') AND EXISTS(
 SELECT 1 FROM public.sourcing_participants p WHERE p.id=p_participant AND p.status NOT IN ('removed','declined')
 AND (p.user_id=auth.uid() OR filmverse_private.provider_sourcing_can(p.organization_id,p_permission)))
$$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_manage(p_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT filmverse_private.sourcing_can(p_event,'manage_sourcing') $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_party(p_participant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT filmverse_private.sourcing_participant_can(p_participant,'view_sourcing') $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_read(p_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT filmverse_private.sourcing_can(p_event,'view_sourcing') OR EXISTS(SELECT 1 FROM public.sourcing_participants p WHERE p.event_id=p_event AND filmverse_private.sourcing_party(p.id))
$$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_bid_read(p_bid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sourcing_bids b JOIN public.sourcing_events e ON e.id=b.event_id WHERE b.id=p_bid
 AND (filmverse_private.sourcing_party(b.participant_id) OR (filmverse_private.sourcing_can(e.id,'evaluate_bids') AND (NOT e.buyer_sealed_until_close OR clock_timestamp()>=e.ends_at))))
$$;

CREATE TABLE public.commercial_offers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),provider_organization_id uuid NOT NULL REFERENCES public.organizations(id),
 offer_type text NOT NULL CHECK(offer_type IN ('student_discount','package_discount','volume_discount','partner_offer','promotion','project_specific_offer','other')),
 scope_category text NOT NULL CHECK(length(scope_category) BETWEEN 1 AND 100),entity_reference uuid,
 eligibility text NOT NULL CHECK(length(eligibility) BETWEEN 1 AND 2000),
 claim_status text NOT NULL CHECK(claim_status IN ('possible','confirmed','sponsored_promotion')),
 discount_basis_points int CHECK(discount_basis_points BETWEEN 1 AND 10000),discount_amount_minor bigint CHECK(discount_amount_minor>0),
 currency text CHECK(currency ~ '^[A-Z]{3}$'),valid_from timestamptz NOT NULL,valid_until timestamptz NOT NULL CHECK(valid_until>valid_from),
 geography text NOT NULL CHECK(length(geography) BETWEEN 1 AND 500),terms text NOT NULL CHECK(length(terms) BETWEEN 1 AND 5000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawn','expired')),
 source text NOT NULL CHECK(source IN ('filmverse','provider_quote','partner_catalog','trusted_external_adapter')),
 source_reference text NOT NULL CHECK(length(source_reference) BETWEEN 1 AND 500),observed_at timestamptz NOT NULL,
 CHECK(discount_basis_points IS NULL OR discount_amount_minor IS NULL),
 CHECK(discount_amount_minor IS NULL OR currency IS NOT NULL),
 CHECK((offer_type<>'promotion' AND claim_status<>'sponsored_promotion') OR (discount_basis_points IS NULL AND discount_amount_minor IS NULL))
);
CREATE INDEX commercial_offer_discovery ON public.commercial_offers(status,valid_until,provider_organization_id);
-- Eligibility must be established by trusted domain evidence, never a browser assertion.
CREATE TABLE filmverse_private.commercial_offer_eligibility(
 offer_id uuid NOT NULL REFERENCES public.commercial_offers(id),participant_id uuid NOT NULL REFERENCES public.sourcing_participants(id),
 evidence_reference text NOT NULL CHECK(length(evidence_reference) BETWEEN 1 AND 500),reviewed_at timestamptz NOT NULL DEFAULT now(),
 valid_until timestamptz NOT NULL,PRIMARY KEY(offer_id,participant_id)
);
ALTER TABLE filmverse_private.commercial_offer_eligibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON filmverse_private.commercial_offer_eligibility FROM PUBLIC,anon,authenticated;
GRANT ALL ON filmverse_private.commercial_offer_eligibility TO service_role;

-- Immutable bid payload; lifecycle is separate append-only evidence, not bid UPDATE.
ALTER TABLE public.sourcing_bids
 ADD COLUMN item_subtotal_minor bigint,
 ADD COLUMN mandatory_additional_costs_minor bigint,
 ADD COLUMN comparable_total_minor bigint,
 ADD COLUMN commercial_terms jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(commercial_terms)='object' AND octet_length(commercial_terms::text)<=8192),
 ADD COLUMN valid_until timestamptz,
 ADD COLUMN availability_status text NOT NULL DEFAULT 'unknown' CHECK(availability_status IN ('unknown','available','conditional','unavailable')),
 ADD COLUMN compliance text NOT NULL DEFAULT 'unspecified' CHECK(compliance IN ('unspecified','compliant','alternative')),
 ADD COLUMN comparison_complete boolean NOT NULL DEFAULT false,
 ADD COLUMN discount_reference uuid REFERENCES public.commercial_offers(id),
 ADD CHECK(item_subtotal_minor IS NULL OR item_subtotal_minor>0),
 ADD CHECK(mandatory_additional_costs_minor IS NULL OR mandatory_additional_costs_minor>=0),
 ADD CHECK(comparable_total_minor IS NULL OR comparable_total_minor=item_subtotal_minor+mandatory_additional_costs_minor);
CREATE TABLE public.sourcing_bid_withdrawals(
 bid_id uuid PRIMARY KEY REFERENCES public.sourcing_bids(id),withdrawn_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 withdrawn_by uuid NOT NULL REFERENCES public.profiles(id),withdrawal_reason text NOT NULL CHECK(length(btrim(withdrawal_reason)) BETWEEN 10 AND 2000)
);
CREATE TRIGGER bid_withdrawal_immutable BEFORE UPDATE OR DELETE ON public.sourcing_bid_withdrawals FOR EACH ROW EXECUTE FUNCTION filmverse_private.ledger_immutable();
CREATE FUNCTION filmverse_private.sourcing_bid_active(p_bid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sourcing_bids b WHERE b.id=p_bid
 AND NOT EXISTS(SELECT 1 FROM public.sourcing_bid_withdrawals w WHERE w.bid_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM public.sourcing_bids newer WHERE newer.participant_id=b.participant_id AND newer.lot_id IS NOT DISTINCT FROM b.lot_id AND newer.revision>b.revision))
$$;
CREATE FUNCTION filmverse_private.sourcing_bid_withdraw(p_bid uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.sourcing_bids;
BEGIN
 SELECT * INTO b FROM public.sourcing_bids WHERE id=p_bid;
 PERFORM 1 FROM public.sourcing_events WHERE id=b.event_id FOR UPDATE;
 IF b.id IS NULL OR NOT filmverse_private.sourcing_participant_can(b.participant_id,'submit_bid') THEN RAISE EXCEPTION 'submission_authority_required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.sourcing_awards WHERE bid_id=b.id) THEN RAISE EXCEPTION 'awarded_offer_cannot_withdraw' USING ERRCODE='23514';END IF;
 INSERT INTO public.sourcing_bid_withdrawals(bid_id,withdrawn_by,withdrawal_reason) VALUES(b.id,auth.uid(),p_reason) ON CONFLICT(bid_id) DO NOTHING;
END $$;
CREATE FUNCTION public.sourcing_bid_withdraw(p_bid uuid,p_reason text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_bid_withdraw(p_bid,p_reason) $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_create(p_project uuid,p_need uuid,p_rules jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; org uuid;
BEGIN
 IF NOT filmverse_private.project_sourcing_can(p_project,'manage_sourcing') THEN RAISE EXCEPTION 'project_authority_required' USING ERRCODE='42501';END IF;
 IF p_rules IS NULL OR jsonb_typeof(p_rules)<>'object' OR octet_length(p_rules::text)>16000 THEN RAISE EXCEPTION 'invalid_rules' USING ERRCODE='22023';END IF;
 SELECT organization_id INTO org FROM public.projects WHERE id=p_project;
 IF p_need IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_needs WHERE id=p_need AND project_id=p_project AND ((target_type='person' AND p_rules->>'event_type'='individual_crew' AND p_rules->>'competition_mode'='sealed_person_proposal') OR (target_type IN ('equipment','package') AND p_rules->>'event_type'='equipment') OR (target_type IN ('organization','postproduction','location','transport','service') AND p_rules->>'event_type'='standard_service'))) THEN RAISE EXCEPTION 'casting_is_not_sourcing' USING ERRCODE='23514';END IF;
 INSERT INTO public.sourcing_events(project_id,buyer_organization_id,need_id,created_by,title,description,event_type,competition_mode,currency,target_budget_minor,budget_ceiling_minor,starts_at,ends_at,bid_scope,buyer_sealed_until_close,rank_visibility,price_visibility,minimum_decrement_minor,extension_window_seconds,extension_duration_seconds,maximum_extension_seconds)
 VALUES(p_project,org,p_need,auth.uid(),p_rules->>'title',coalesce(p_rules->>'description',''),p_rules->>'event_type',p_rules->>'competition_mode',p_rules->>'currency',
 (p_rules->>'target_budget_minor')::bigint,(p_rules->>'budget_ceiling_minor')::bigint,(p_rules->>'starts_at')::timestamptz,(p_rules->>'ends_at')::timestamptz,coalesce(p_rules->>'bid_scope','whole_event'),coalesce((p_rules->>'buyer_sealed_until_close')::boolean,true),coalesce((p_rules->>'rank_visibility')::boolean,false),coalesce((p_rules->>'price_visibility')::boolean,false),coalesce((p_rules->>'minimum_decrement_minor')::bigint,100),coalesce((p_rules->>'extension_window_seconds')::int,120),coalesce((p_rules->>'extension_duration_seconds')::int,120),coalesce((p_rules->>'maximum_extension_seconds')::int,3600)) RETURNING id INTO result;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_invite(p_event uuid,p_user uuid,p_org uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sourcing_events; result uuid;
BEGIN
 SELECT * INTO e FROM public.sourcing_events WHERE id=p_event FOR UPDATE;
 IF NOT filmverse_private.sourcing_can(p_event,'invite_sourcing_participants') OR e.status NOT IN ('draft','qualification','scheduled') THEN RAISE EXCEPTION 'invitation_unavailable' USING ERRCODE='42501';END IF;
 IF (p_user IS NOT NULL)::int+(p_org IS NOT NULL)::int<>1 OR (p_user IS NOT NULL AND (p_user=e.created_by OR NOT filmverse_private.person_contactable(p_user,'invite'))) OR (p_org IS NOT NULL AND (p_org=e.buyer_organization_id OR NOT filmverse_private.org_public(p_org))) OR (e.event_type='individual_crew' AND p_org IS NOT NULL) THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 INSERT INTO public.sourcing_participants(event_id,user_id,organization_id) VALUES(p_event,p_user,p_org) RETURNING id INTO result;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_participant_decide(p_participant uuid,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.sourcing_participants; e public.sourcing_events;
BEGIN
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant;
 SELECT * INTO e FROM public.sourcing_events WHERE id=p.event_id FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant;
 IF p_action='accept' AND filmverse_private.sourcing_participant_can(p.id,'submit_bid') AND p.status IN ('invited','accepted','qualified') THEN UPDATE public.sourcing_participants SET status=CASE WHEN status='qualified' THEN status ELSE 'accepted' END,acknowledged_version=e.event_version WHERE id=p.id;
 ELSIF p_action='decline' AND filmverse_private.sourcing_participant_can(p.id,'submit_bid') THEN UPDATE public.sourcing_participants SET status='declined' WHERE id=p.id;
 ELSIF p_action='qualify' AND filmverse_private.sourcing_can(e.id,'invite_sourcing_participants') AND p.status='accepted' THEN UPDATE public.sourcing_participants SET status='qualified' WHERE id=p.id;
 ELSIF p_action='remove' AND filmverse_private.sourcing_can(e.id,'invite_sourcing_participants') THEN UPDATE public.sourcing_participants SET status='removed' WHERE id=p.id;
 ELSE RAISE EXCEPTION 'participant_action_denied' USING ERRCODE='42501';END IF;
END $$;
CREATE FUNCTION filmverse_private.bid_terms_validate(p_terms jsonb) RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text; additional bigint:=0;
BEGIN
 IF p_terms IS NULL OR jsonb_typeof(p_terms)<>'object' OR octet_length(p_terms::text)>8192 THEN RAISE EXCEPTION 'invalid_commercial_terms' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_terms) key WHERE key NOT IN
 ('version','valid_until','availability_status','availability_statement','delivery_cost_minor','pickup_cost_minor','tax_inclusion','tax_amount_minor','deposit_terms','insurance_terms','prep_service_cost_minor','other_mandatory_fees_minor','commercial_terms_summary','compliance','alternative_specification','discount_reference','comparison_complete'))
 THEN RAISE EXCEPTION 'unknown_commercial_term' USING ERRCODE='22023';END IF;
 IF p_terms='{}' THEN RETURN 0;END IF;
 IF p_terms->>'version' IS DISTINCT FROM '1' OR jsonb_typeof(p_terms->'comparison_complete') IS DISTINCT FROM 'boolean'
 OR coalesce(p_terms->>'availability_status','') NOT IN ('unknown','available','conditional','unavailable')
 OR coalesce(p_terms->>'tax_inclusion','') NOT IN ('included','excluded','unknown')
 OR coalesce(p_terms->>'compliance','') NOT IN ('compliant','alternative') THEN RAISE EXCEPTION 'invalid_commercial_classification' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['availability_statement','deposit_terms','insurance_terms','commercial_terms_summary'] LOOP
 IF p_terms?k AND (jsonb_typeof(p_terms->k)<>'string' OR length(p_terms->>k)>2000) THEN RAISE EXCEPTION 'bounded_commercial_text_required' USING ERRCODE='22023';END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['delivery_cost_minor','pickup_cost_minor','tax_amount_minor','prep_service_cost_minor','other_mandatory_fees_minor'] LOOP
 IF p_terms?k AND (jsonb_typeof(p_terms->k)<>'number' OR (p_terms->>k)!~'^[0-9]+$' OR (p_terms->>k)::numeric>1000000000000) THEN RAISE EXCEPTION 'integer_minor_cost_required' USING ERRCODE='22023';END IF;
 IF k<>'tax_amount_minor' OR p_terms->>'tax_inclusion'='excluded' THEN additional:=additional+coalesce((p_terms->>k)::bigint,0);END IF;
 END LOOP;
 IF (p_terms->>'comparison_complete')::boolean AND
 (NOT p_terms?&ARRAY['delivery_cost_minor','pickup_cost_minor','prep_service_cost_minor','other_mandatory_fees_minor','valid_until','availability_statement','commercial_terms_summary','deposit_terms','insurance_terms']
 OR p_terms->>'tax_inclusion'='unknown' OR (p_terms->>'tax_inclusion'='excluded' AND NOT p_terms?'tax_amount_minor')
 OR length(btrim(p_terms->>'commercial_terms_summary'))=0 OR length(btrim(p_terms->>'availability_statement'))=0)
 THEN RAISE EXCEPTION 'complete_comparable_costs_required' USING ERRCODE='22023';END IF;
 IF p_terms->>'compliance'='alternative' THEN
 IF jsonb_typeof(p_terms->'alternative_specification') IS DISTINCT FROM 'object'
 OR NOT (p_terms->'alternative_specification')?&ARRAY['requested','offered','deviation']
 OR EXISTS(SELECT 1 FROM jsonb_each(p_terms->'alternative_specification') e WHERE e.key NOT IN ('requested','offered','deviation') OR jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}') NOT BETWEEN 1 AND 1000)
 THEN RAISE EXCEPTION 'factual_alternative_required' USING ERRCODE='22023';END IF;
 ELSIF p_terms?'alternative_specification' THEN RAISE EXCEPTION 'alternative_must_be_explicit' USING ERRCODE='22023';END IF;
 RETURN additional;
END $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_bid_submit(p_event uuid,p_participant uuid,p_lot uuid,p_request uuid,p_items jsonb,p_terms jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.sourcing_events;p public.sourcing_participants;existing public.sourcing_bids;total bigint;best bigint;result uuid;rev int;extra int; stamp timestamptz; subtotal bigint; additional bigint; complete boolean;
BEGIN
 SELECT * INTO e FROM public.sourcing_events WHERE id=p_event FOR UPDATE;
 IF e.id IS NULL OR NOT filmverse_private.sourcing_participant_can(p_participant,'submit_bid') THEN RAISE EXCEPTION 'participant_authority_required' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant AND event_id=e.id;
 IF p.id IS NULL THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 IF p_request IS NULL OR p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 OR octet_length(p_items::text)>50000 THEN RAISE EXCEPTION 'invalid_bid_items' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE jsonb_typeof(i)<>'object' OR NOT(i?'description' AND i?'quantity' AND i?'unit_price_minor') OR (SELECT count(*) FROM jsonb_object_keys(i))<>3 OR length(i->>'description') NOT BETWEEN 1 AND 1000 OR (i->>'quantity')::int NOT BETWEEN 1 AND 100000 OR (i->>'unit_price_minor')::bigint NOT BETWEEN 0 AND 100000000000) THEN RAISE EXCEPTION 'invalid_bid_item' USING ERRCODE='22023';END IF;
 SELECT sum((i->>'quantity')::bigint*(i->>'unit_price_minor')::bigint) INTO subtotal FROM jsonb_array_elements(p_items)i;
 additional:=filmverse_private.bid_terms_validate(p_terms);
 complete:=coalesce((p_terms->>'comparison_complete')::boolean,false);
 total:=subtotal+additional;
 SELECT * INTO existing FROM public.sourcing_bids WHERE submitted_by=auth.uid() AND request_id=p_request;
 IF FOUND THEN
 IF (existing.event_id,existing.participant_id,existing.lot_id,existing.amount_minor,existing.commercial_terms) IS DISTINCT FROM (e.id,p.id,p_lot,total,p_terms) OR (SELECT jsonb_agg(jsonb_build_object('description',description,'quantity',quantity,'unit_price_minor',unit_price_minor) ORDER BY position) FROM public.sourcing_bid_items WHERE bid_id=existing.id) IS DISTINCT FROM p_items THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23514';END IF;RETURN existing.id;
 END IF;
 stamp:=clock_timestamp();
 IF p_terms<>'{}' AND (p_terms->>'valid_until' IS NULL OR (p_terms->>'valid_until')::timestamptz<=stamp) THEN RAISE EXCEPTION 'offer_validity_required' USING ERRCODE='22023';END IF;
 IF p_terms->>'discount_reference' IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.commercial_offers o JOIN filmverse_private.commercial_offer_eligibility eligibility ON eligibility.offer_id=o.id AND eligibility.participant_id=p.id
 WHERE o.id=(p_terms->>'discount_reference')::uuid AND o.provider_organization_id=p.organization_id AND o.status='published' AND o.claim_status='confirmed'
 AND o.offer_type<>'promotion' AND (o.discount_basis_points IS NOT NULL OR o.discount_amount_minor IS NOT NULL)
 AND (o.currency IS NULL OR o.currency=e.currency) AND stamp BETWEEN o.valid_from AND o.valid_until AND eligibility.valid_until>stamp)
 THEN RAISE EXCEPTION 'confirmed_discount_eligibility_required' USING ERRCODE='42501';END IF;
 IF p.status<>'qualified' OR p.acknowledged_version<>e.event_version OR e.status<>'open' OR stamp<e.starts_at OR stamp>=e.ends_at THEN RAISE EXCEPTION 'bidding_not_open_or_acknowledged' USING ERRCODE='23514';END IF;
 IF (e.bid_scope='whole_event' AND p_lot IS NOT NULL) OR (e.bid_scope='lots' AND NOT EXISTS(SELECT 1 FROM public.sourcing_lots WHERE id=p_lot AND event_id=e.id)) THEN RAISE EXCEPTION 'bid_scope_mismatch' USING ERRCODE='23514';END IF;
 IF total IS NULL OR total<=0 OR (e.budget_ceiling_minor IS NOT NULL AND total>e.budget_ceiling_minor) THEN RAISE EXCEPTION 'bid_outside_budget' USING ERRCODE='23514';END IF;
 IF e.competition_mode IN ('reverse_auction','ranked_reverse') THEN
 IF NOT complete OR p_terms->>'compliance'<>'compliant' OR p_terms->>'availability_status' NOT IN ('available','conditional') THEN RAISE EXCEPTION 'reverse_requires_complete_compliant_offer' USING ERRCODE='23514';END IF;
 SELECT min(b.amount_minor) INTO best FROM public.sourcing_bids b JOIN public.sourcing_participants sp ON sp.id=b.participant_id AND sp.status='qualified'
 WHERE b.event_id=e.id AND b.event_version=e.event_version AND b.lot_id IS NOT DISTINCT FROM p_lot AND filmverse_private.sourcing_bid_active(b.id) AND b.comparison_complete AND b.compliance='compliant' AND b.availability_status IN ('available','conditional') AND b.valid_until>stamp;
 IF best IS NOT NULL AND total>best-e.minimum_decrement_minor THEN RAISE EXCEPTION 'minimum_decrement_required' USING ERRCODE='23514';END IF;
 END IF;
 SELECT coalesce(max(revision),0)+1 INTO rev FROM public.sourcing_bids WHERE participant_id=p.id AND lot_id IS NOT DISTINCT FROM p_lot;
 INSERT INTO public.sourcing_bids(event_id,participant_id,lot_id,event_version,revision,amount_minor,submitted_by,request_id,item_subtotal_minor,mandatory_additional_costs_minor,comparable_total_minor,commercial_terms,valid_until,availability_status,compliance,comparison_complete,discount_reference) VALUES(e.id,p.id,p_lot,e.event_version,rev,total,auth.uid(),p_request,subtotal,additional,CASE WHEN complete THEN total END,p_terms,(p_terms->>'valid_until')::timestamptz,coalesce(p_terms->>'availability_status','unknown'),coalesce(p_terms->>'compliance','unspecified'),complete,(p_terms->>'discount_reference')::uuid) RETURNING id INTO result;
 INSERT INTO public.sourcing_bid_items(bid_id,position,description,quantity,unit_price_minor) SELECT result,n::int,i->>'description',(i->>'quantity')::int,(i->>'unit_price_minor')::bigint FROM jsonb_array_elements(p_items) WITH ORDINALITY a(i,n);
 IF e.competition_mode IN ('reverse_auction','ranked_reverse') AND e.ends_at-stamp<=make_interval(secs=>e.extension_window_seconds) THEN
 extra:=least(e.extension_duration_seconds,e.maximum_extension_seconds-e.extended_seconds);
 UPDATE public.sourcing_events SET ends_at=ends_at+make_interval(secs=>extra),extended_seconds=extended_seconds+extra WHERE id=e.id;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.sourcing_bid_submit(p_event uuid,p_participant uuid,p_lot uuid,p_request uuid,p_items jsonb,p_terms jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_bid_submit(p_event,p_participant,p_lot,p_request,p_items,p_terms) $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_bid_submit(p_event uuid,p_participant uuid,p_lot uuid,p_request uuid,p_items jsonb) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT filmverse_private.sourcing_bid_submit(p_event,p_participant,p_lot,p_request,p_items,'{}') $$;
CREATE FUNCTION filmverse_private.bid_discount_current(p_bid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sourcing_bids b JOIN public.sourcing_participants p ON p.id=b.participant_id JOIN public.sourcing_events e ON e.id=b.event_id
 WHERE b.id=p_bid AND (b.discount_reference IS NULL OR EXISTS(
 SELECT 1 FROM public.commercial_offers o JOIN filmverse_private.commercial_offer_eligibility x ON x.offer_id=o.id AND x.participant_id=p.id
 WHERE o.id=b.discount_reference AND o.provider_organization_id=p.organization_id AND o.status='published' AND o.claim_status='confirmed'
 AND o.offer_type<>'promotion' AND (o.discount_basis_points IS NOT NULL OR o.discount_amount_minor IS NOT NULL)
 AND (o.currency IS NULL OR o.currency=e.currency) AND clock_timestamp() BETWEEN o.valid_from AND o.valid_until AND x.valid_until>clock_timestamp())))
$$;
REVOKE ALL ON FUNCTION filmverse_private.bid_discount_current(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_award(p_bid uuid,p_method text,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.sourcing_bids;e public.sourcing_events;result uuid;
BEGIN
 SELECT * INTO b FROM public.sourcing_bids WHERE id=p_bid;SELECT * INTO e FROM public.sourcing_events WHERE id=b.event_id FOR UPDATE;
 IF NOT filmverse_private.sourcing_can(e.id,'award_sourcing') THEN RAISE EXCEPTION 'buyer_authority_required' USING ERRCODE='42501';END IF;
 IF NOT filmverse_private.sourcing_bid_active(b.id) OR NOT filmverse_private.bid_discount_current(b.id) OR NOT b.comparison_complete OR b.valid_until IS NULL OR b.valid_until<=clock_timestamp() OR b.availability_status NOT IN ('available','conditional') OR e.id IS NULL OR clock_timestamp()<e.ends_at OR e.status NOT IN ('open','evaluation','negotiation','awarded') OR b.event_version<>e.event_version
 OR NOT EXISTS(SELECT 1 FROM public.sourcing_participants WHERE id=b.participant_id AND status='qualified')
 OR EXISTS(SELECT 1 FROM public.sourcing_bids newer WHERE newer.participant_id=b.participant_id AND newer.lot_id IS NOT DISTINCT FROM b.lot_id AND newer.revision>b.revision)
 OR EXISTS(SELECT 1 FROM public.sourcing_bid_professionals WHERE bid_id=b.id AND status<>'confirmed') THEN RAISE EXCEPTION 'award_not_eligible' USING ERRCODE='23514';END IF;
 IF p_method='lowest_compliant_bid' AND b.compliance<>'compliant' THEN RAISE EXCEPTION 'alternative_not_automatically_compliant' USING ERRCODE='23514';END IF;
 IF p_method='lowest_compliant_bid' AND EXISTS(SELECT 1 FROM public.sourcing_bids rival JOIN public.sourcing_participants sp ON sp.id=rival.participant_id AND sp.status='qualified' WHERE rival.event_id=e.id AND rival.event_version=e.event_version AND rival.lot_id IS NOT DISTINCT FROM b.lot_id AND rival.comparable_total_minor<b.comparable_total_minor AND filmverse_private.bid_discount_current(rival.id) AND filmverse_private.sourcing_bid_active(rival.id) AND rival.comparison_complete AND rival.compliance='compliant' AND rival.valid_until>clock_timestamp() AND rival.availability_status IN ('available','conditional') AND NOT EXISTS(SELECT 1 FROM public.sourcing_bid_professionals consent WHERE consent.bid_id=rival.id AND consent.status<>'confirmed') AND NOT EXISTS(SELECT 1 FROM public.sourcing_bids newer WHERE newer.participant_id=rival.participant_id AND newer.lot_id IS NOT DISTINCT FROM rival.lot_id AND newer.revision>rival.revision)) THEN RAISE EXCEPTION 'lower_compliant_bid_exists' USING ERRCODE='23514';END IF;
 INSERT INTO public.sourcing_awards(event_id,lot_id,bid_id,method,rationale,awarded_by) VALUES(e.id,b.lot_id,b.id,p_method,p_reason,auth.uid()) RETURNING id INTO result;
 UPDATE public.sourcing_events SET status='awarded' WHERE id=e.id;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION filmverse_private.sourcing_feedback(p_participant uuid,p_lot uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.sourcing_participants;e public.sourcing_events; own bigint; best bigint;rank bigint;
BEGIN
 IF NOT filmverse_private.sourcing_party(p_participant) THEN RAISE EXCEPTION 'participant_unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.sourcing_participants WHERE id=p_participant;SELECT * INTO e FROM public.sourcing_events WHERE id=p.event_id;
 IF e.competition_mode NOT IN ('reverse_auction','ranked_reverse') THEN RETURN '{}'::jsonb;END IF;
 SELECT amount_minor INTO own FROM public.sourcing_bids WHERE participant_id=p.id AND event_version=e.event_version AND lot_id IS NOT DISTINCT FROM p_lot AND filmverse_private.sourcing_bid_active(id) AND comparison_complete AND compliance='compliant' AND availability_status IN ('available','conditional') AND valid_until>clock_timestamp() ORDER BY revision DESC LIMIT 1;
 SELECT min(amount_minor),1+count(DISTINCT participant_id) FILTER(WHERE amount_minor<own) INTO best,rank FROM public.sourcing_bids b WHERE b.event_id=e.id AND b.event_version=e.event_version AND b.lot_id IS NOT DISTINCT FROM p_lot AND filmverse_private.sourcing_bid_active(b.id) AND b.comparison_complete AND b.compliance='compliant' AND b.availability_status IN ('available','conditional') AND b.valid_until>clock_timestamp() AND EXISTS(SELECT 1 FROM public.sourcing_participants sp WHERE sp.id=b.participant_id AND sp.status='qualified');
 RETURN jsonb_build_object('best_price_minor',CASE WHEN e.price_visibility THEN best END,'rank',CASE WHEN e.rank_visibility AND own IS NOT NULL THEN rank END);
END $$;
-- Questions are private to buyer + asking supplier until deliberately published.
ALTER TABLE public.sourcing_questions ALTER COLUMN answer DROP NOT NULL,
 ADD COLUMN participant_id uuid REFERENCES public.sourcing_participants(id),
 ADD COLUMN asked_by uuid REFERENCES public.profiles(id),
 ADD COLUMN state text NOT NULL DEFAULT 'published_to_all' CHECK(state IN ('asked','answered','published_to_all','private_provider_specific')),
 ADD COLUMN common_scope_change boolean NOT NULL DEFAULT false,
 ADD COLUMN answered_at timestamptz,
 ADD COLUMN event_version int;
REVOKE INSERT(event_id,question,answer) ON public.sourcing_questions FROM authenticated;
DROP POLICY question_publish ON public.sourcing_questions;
ALTER POLICY question_read ON public.sourcing_questions USING(
 filmverse_private.sourcing_can(event_id,'manage_sourcing') OR
 (state='published_to_all' AND filmverse_private.sourcing_read(event_id)) OR filmverse_private.sourcing_party(participant_id));
CREATE FUNCTION filmverse_private.sourcing_question_ask(p_event uuid,p_participant uuid,p_question text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF NOT filmverse_private.sourcing_participant_can(p_participant,'prepare_bid') AND NOT filmverse_private.sourcing_participant_can(p_participant,'submit_bid') THEN RAISE EXCEPTION 'question_authority_required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sourcing_participants WHERE id=p_participant AND event_id=p_event) THEN RAISE EXCEPTION 'question_context_mismatch' USING ERRCODE='42501';END IF;
 INSERT INTO public.sourcing_questions(event_id,participant_id,asked_by,question,state,answer) VALUES(p_event,p_participant,auth.uid(),p_question,'asked',NULL) RETURNING id INTO result;RETURN result;
END $$;
CREATE FUNCTION filmverse_private.sourcing_question_answer(p_id uuid,p_answer text,p_publish boolean,p_scope_change boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE question public.sourcing_questions;e public.sourcing_events;
BEGIN
 SELECT * INTO question FROM public.sourcing_questions WHERE id=p_id;
 SELECT * INTO e FROM public.sourcing_events WHERE id=question.event_id FOR UPDATE;
 SELECT * INTO question FROM public.sourcing_questions WHERE id=p_id FOR UPDATE;
 IF e.id IS NULL OR NOT filmverse_private.sourcing_can(e.id,'manage_sourcing') THEN RAISE EXCEPTION 'question_authority_required' USING ERRCODE='42501';END IF;
 IF question.state<>'asked' OR p_publish IS NULL OR p_scope_change IS NULL OR p_answer IS NULL OR length(btrim(p_answer)) NOT BETWEEN 1 AND 5000
 OR (p_scope_change AND NOT p_publish) THEN RAISE EXCEPTION 'equal_scope_disclosure_required' USING ERRCODE='23514';END IF;
 IF p_scope_change THEN
 IF e.status IN ('awarded','closed','cancelled') OR e.ends_at<=clock_timestamp() THEN RAISE EXCEPTION 'closed_scope_cannot_change' USING ERRCODE='23514';END IF;
 UPDATE public.sourcing_events SET event_version=event_version+1,status='qualification' WHERE id=e.id RETURNING * INTO e;
 INSERT INTO public.sourcing_rule_notices(event_id,event_version,reason) VALUES(e.id,e.event_version,'Common scope clarification: '||left(p_answer,1900));
 END IF;
 UPDATE public.sourcing_questions SET answer=p_answer,state=CASE WHEN p_publish THEN 'published_to_all' ELSE 'private_provider_specific' END,
 common_scope_change=p_scope_change,answered_at=now(),published_by=auth.uid(),event_version=e.event_version WHERE id=p_id;
END $$;
CREATE FUNCTION public.sourcing_question_ask(p_event uuid,p_participant uuid,p_question text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_question_ask(p_event,p_participant,p_question) $$;
CREATE FUNCTION public.sourcing_question_answer(p_id uuid,p_answer text,p_publish boolean,p_scope_change boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_question_answer(p_id,p_answer,p_publish,p_scope_change) $$;

DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['project_sourcing_authorities','organization_sourcing_authorities','commercial_offers','sourcing_bid_withdrawals'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE POLICY project_sourcing_grant_read ON public.project_sourcing_authorities FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY provider_sourcing_grant_read ON public.organization_sourcing_authorities FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY withdrawal_read ON public.sourcing_bid_withdrawals FOR SELECT TO authenticated USING(filmverse_private.sourcing_bid_read(bid_id));
CREATE POLICY commercial_offer_read ON public.commercial_offers FOR SELECT TO authenticated USING(
 filmverse_private.provider_sourcing_can(provider_organization_id,'view_sourcing') OR
 (status='published' AND now() BETWEEN valid_from AND valid_until AND filmverse_private.org_discoverable(provider_organization_id)));
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure sig,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','filmverse_private') AND p.proname IN
 ('project_sourcing_can','provider_sourcing_can','sourcing_can','sourcing_participant_can','sourcing_bid_active','sourcing_bid_withdraw','bid_terms_validate','sourcing_bid_submit','sourcing_question_ask','sourcing_question_answer') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.sig);
 IF f.proname NOT IN ('bid_terms_validate','sourcing_bid_active') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END IF;
 END LOOP;
END $$;
REVOKE SELECT ON public.sourcing_questions FROM authenticated;
GRANT SELECT(id,event_id,question,answer,published_by,created_at,state,common_scope_change,answered_at,event_version) ON public.sourcing_questions TO authenticated;
CREATE FUNCTION filmverse_private.sourcing_bid_lifecycle(p_bid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT filmverse_private.sourcing_bid_read(p_bid) THEN RAISE EXCEPTION 'bid_unavailable' USING ERRCODE='42501';END IF;
 RETURN (SELECT jsonb_build_object('status',CASE WHEN w.bid_id IS NOT NULL THEN 'withdrawn'
 WHEN filmverse_private.sourcing_bid_active(b.id) THEN 'active' ELSE 'superseded' END,'withdrawn_at',w.withdrawn_at,'withdrawal_reason',w.withdrawal_reason)
 FROM public.sourcing_bids b LEFT JOIN public.sourcing_bid_withdrawals w ON w.bid_id=b.id WHERE b.id=p_bid);
END $$;
CREATE FUNCTION public.sourcing_bid_lifecycle(p_bid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.sourcing_bid_lifecycle(p_bid) $$;
REVOKE ALL ON FUNCTION filmverse_private.sourcing_bid_lifecycle(uuid),public.sourcing_bid_lifecycle(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION filmverse_private.sourcing_bid_lifecycle(uuid),public.sourcing_bid_lifecycle(uuid) TO authenticated;
COMMIT;
