BEGIN;
SET LOCAL lock_timeout='5s';
-- Reviewed migrations remain untouched. Existing verified policy keeps its limits.
INSERT INTO public.student_program_policy VALUES('support_requests_basic',3,1,true);
ALTER TABLE public.organization_student_support ADD COLUMN eligibility text NOT NULL DEFAULT 'all_student_projects' CHECK(eligibility IN ('all_student_projects','verified_only'));
GRANT INSERT(eligibility),UPDATE(eligibility) ON public.organization_student_support TO authenticated;
ALTER TABLE public.project_support_requests ALTER COLUMN usage_rights DROP NOT NULL,ALTER COLUMN deliverables DROP NOT NULL;
ALTER TABLE public.project_support_requests ADD COLUMN details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object' AND octet_length(details::text)<=4096);
-- Bounded type-specific keys; validate on all writes, including trusted imports.
CREATE FUNCTION filmverse_private.support_details_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.details - ARRAY['topic','duration_minutes','remote','route','equipment_category','deliverable','usage_rights']::text[] <> '{}' THEN RAISE EXCEPTION 'unknown_support_detail' USING ERRCODE='22023'; END IF;
 IF NEW.need_type='mentorship' AND (length(btrim(coalesce(NEW.mentorship_topic,'')))=0 OR NEW.duration_minutes IS NULL) THEN RAISE EXCEPTION 'mentorship_details_required' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER support_details BEFORE INSERT OR UPDATE ON public.project_support_requests FOR EACH ROW EXECUTE FUNCTION filmverse_private.support_details_guard();
CREATE OR REPLACE FUNCTION filmverse_private.support_request_create(p_project uuid,p_data jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg public.student_program_policy; result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 PERFORM 1 FROM public.projects WHERE id=p_project FOR UPDATE;
 IF NOT filmverse_private.project_can(p_project) OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p_project AND student_project)
 THEN RAISE EXCEPTION 'verified_student_project_authority_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO cfg FROM public.student_program_policy WHERE key=CASE WHEN filmverse_private.student_project_verified(p_project) THEN 'support_requests' ELSE 'support_requests_basic' END;
 IF NOT FOUND OR NOT cfg.enabled OR (SELECT count(*) FROM public.project_support_requests WHERE created_by=auth.uid() AND status='open')>=cfg.max_open_requests
 OR (SELECT count(*) FROM public.project_support_requests WHERE created_by=auth.uid() AND created_at>now()-interval '1 day')>=cfg.daily_requests
 THEN RAISE EXCEPTION 'support_request_limit' USING ERRCODE='23514'; END IF;
 INSERT INTO public.project_support_requests(project_id,created_by,need_type,department_id,profession_id,organization_type,inventory_category,title,description,quantity,city,start_date,end_date,compensation_type,expenses_covered,usage_rights,deliverables,credit_offered,visibility,mentorship_topic,duration_minutes,remote,details)
 VALUES(p_project,auth.uid(),p_data->>'need_type',nullif(p_data->>'department_id','')::uuid,nullif(p_data->>'profession_id','')::uuid,nullif(p_data->>'organization_type',''),nullif(p_data->>'inventory_category',''),p_data->>'title',coalesce(p_data->>'description',''),coalesce((p_data->>'quantity')::int,1),p_data->>'city',(p_data->>'start_date')::date,(p_data->>'end_date')::date,p_data->>'compensation_type',p_data->>'expenses_covered',nullif(btrim(p_data->>'usage_rights'),''),nullif(btrim(p_data->>'deliverables'),''),coalesce((p_data->>'credit_offered')::boolean,false),coalesce(p_data->>'visibility','private'),p_data->>'mentorship_topic',nullif(p_data->>'duration_minutes','')::int,coalesce((p_data->>'remote')::boolean,false),coalesce(p_data->'details','{}')) RETURNING id INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION filmverse_private.person_contactable(p_user uuid,p_action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND filmverse_private.support_not_blocked(p_user) AND p_user<>auth.uid() AND filmverse_private.person_visible(p_user)
 AND (coalesce((SELECT CASE p_action WHEN 'message' THEN message_permission ELSE invite_permission END
 FROM public.profile_privacy_settings WHERE user_id=p_user),'members')='members'
 OR (coalesce((SELECT CASE p_action WHEN 'message' THEN message_permission ELSE invite_permission END
 FROM public.profile_privacy_settings WHERE user_id=p_user),'members')='work_context' AND filmverse_private.person_work_context(p_user)))
$$;

CREATE OR REPLACE FUNCTION filmverse_private.contact_visible(p_user uuid,p_visibility text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user=auth.uid() OR (filmverse_private.support_not_blocked(p_user) AND filmverse_private.person_visible(p_user) AND
 (p_visibility='public' OR (p_visibility='members' AND auth.uid() IS NOT NULL)
 OR (p_visibility='work_context' AND filmverse_private.person_work_context(p_user))))
$$;

CREATE FUNCTION filmverse_private.direct_block_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE peer uuid;
BEGIN
 SELECT CASE WHEN r.direct_a=NEW.sender_id THEN r.direct_b ELSE r.direct_a END INTO peer FROM public.chat_rooms r WHERE r.id=NEW.room_id AND r.kind='direct';
 IF peer IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_blocks WHERE (user_id=NEW.sender_id AND blocked_user_id=peer) OR (user_id=peer AND blocked_user_id=NEW.sender_id)) THEN RAISE EXCEPTION 'communication_unavailable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER direct_block_send BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION filmverse_private.direct_block_guard();
-- Audit fields cannot be written by applicants. Old API remains compatible but new UI supplies a reason.
ALTER TABLE public.student_verifications ADD COLUMN reviewed_at timestamptz,ADD COLUMN decision_reason text CHECK(length(decision_reason)<=1000);
CREATE OR REPLACE FUNCTION filmverse_private.student_verification_review(p_id uuid,p_approve boolean,p_until timestamptz,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.student_verifications; a public.education_affiliations;
BEGIN
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 1000 THEN RAISE EXCEPTION 'decision_reason_required' USING ERRCODE='22023'; END IF;
 IF NOT filmverse_private.student_reviewer() THEN RAISE EXCEPTION 'review_permission_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.student_verifications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v.user_id=auth.uid() OR v.status<>'pending' THEN RAISE EXCEPTION 'review_forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.education_affiliations WHERE id=v.affiliation_id FOR UPDATE;
 IF p_approve AND (a.revision<>v.affiliation_revision OR a.status<>'current_student' OR p_until IS NULL OR p_until<=now()
 OR p_until>now()+interval '1 year' OR p_until>make_date(a.expected_graduation_year,12,31)+interval '1 day')
 THEN RAISE EXCEPTION 'invalid_verification_expiry' USING ERRCODE='22023'; END IF;
 UPDATE public.student_verifications SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 reviewed_by=auth.uid(),reviewed_at=now(),decision_reason=btrim(p_reason),verified_at=CASE WHEN p_approve THEN now() ELSE NULL END,valid_until=CASE WHEN p_approve THEN p_until ELSE NULL END WHERE id=p_id;
END $$;

CREATE OR REPLACE FUNCTION filmverse_private.student_verification_review(p_id uuid,p_approve boolean,p_until timestamptz) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT filmverse_private.student_verification_review(p_id,p_approve,p_until,'Legacy review: no detailed reason supplied') $$;
CREATE FUNCTION public.student_verification_decide(p_id uuid,p_approve boolean,p_until timestamptz,p_reason text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_verification_review(p_id,p_approve,p_until,p_reason) $$;
CREATE OR REPLACE FUNCTION filmverse_private.student_review_queue() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT v.id,v.user_id,p.full_name,p.public_slug,v.evidence_path,v.created_at,a.institution_name,a.program,a.specialization,a.expected_graduation_year
 FROM public.student_verifications v JOIN public.education_affiliations a ON a.id=v.affiliation_id JOIN public.profiles p ON p.id=v.user_id
 WHERE filmverse_private.student_reviewer() AND v.status='pending' AND v.user_id<>auth.uid() ORDER BY v.created_at,v.id LIMIT 50) r
$$;
ALTER TABLE public.work_opportunities ADD COLUMN model_requirements jsonb NOT NULL DEFAULT '{}';
CREATE FUNCTION filmverse_private.model_requirement_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF jsonb_typeof(NEW.model_requirements)<>'object' OR octet_length(NEW.model_requirements::text)>4096 OR NEW.model_requirements - ARRAY['categories','height_min','height_max','travel','digitals_required','portfolio_required']::text[]<>'{}' THEN RAISE EXCEPTION 'invalid_model_requirements' USING ERRCODE='22023'; END IF;
 IF NEW.model_requirements ? 'categories' AND (jsonb_typeof(NEW.model_requirements->'categories')<>'array' OR NOT ARRAY(SELECT jsonb_array_elements_text(NEW.model_requirements->'categories')) <@ ARRAY['fashion','editorial','commercial','lifestyle','beauty','runway','ecommerce','fit','parts','promotional','character','other']) THEN RAISE EXCEPTION 'invalid_model_categories' USING ERRCODE='22023'; END IF;
 IF coalesce((NEW.model_requirements->>'height_min')::numeric,50)<50 OR coalesce((NEW.model_requirements->>'height_max')::numeric,250)>250 OR coalesce((NEW.model_requirements->>'height_min')::numeric,50)>coalesce((NEW.model_requirements->>'height_max')::numeric,250) THEN RAISE EXCEPTION 'invalid_height_range' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(NEW.model_requirements) e WHERE key IN ('travel','digitals_required','portfolio_required') AND jsonb_typeof(value)<>'boolean') THEN RAISE EXCEPTION 'invalid_requirement_boolean' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER model_requirement BEFORE INSERT OR UPDATE ON public.work_opportunities FOR EACH ROW EXECUTE FUNCTION filmverse_private.model_requirement_guard();
GRANT INSERT(model_requirements),UPDATE(model_requirements) ON public.work_opportunities TO authenticated;
CREATE OR REPLACE VIEW public.work_opportunities_discovery WITH(security_invoker=true) AS SELECT * FROM public.work_opportunities WHERE visibility='public' AND filmverse_private.org_discoverable(organization_id);
REVOKE ALL ON FUNCTION filmverse_private.support_details_guard(),filmverse_private.direct_block_guard(),filmverse_private.model_requirement_guard(),filmverse_private.student_verification_review(uuid,boolean,timestamptz,text),public.student_verification_decide(uuid,boolean,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.student_verification_review(uuid,boolean,timestamptz,text),public.student_verification_decide(uuid,boolean,timestamptz,text) TO authenticated;
-- Program eligibility is a factual check, not a message-delivery claim.
CREATE FUNCTION filmverse_private.student_program_eligible(p_org uuid,p_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND filmverse_private.project_can(p_project) AND EXISTS(
 SELECT 1 FROM public.projects p JOIN public.organization_student_support s ON s.organization_id=p_org
 WHERE p.id=p_project AND p.student_project AND s.enabled AND filmverse_private.org_public(p_org)
 AND (s.eligibility='all_student_projects' OR filmverse_private.student_project_verified(p.id)))
$$;
CREATE FUNCTION public.student_program_eligible(p_org uuid,p_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT filmverse_private.student_program_eligible(p_org,p_project) $$;
REVOKE ALL ON FUNCTION filmverse_private.student_program_eligible(uuid,uuid),public.student_program_eligible(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION filmverse_private.student_program_eligible(uuid,uuid),public.student_program_eligible(uuid,uuid) TO authenticated;
-- The legacy endpoint has no decision reason; keep historical definition but close client execution.
REVOKE EXECUTE ON FUNCTION public.student_verification_review(uuid,boolean,timestamptz),filmverse_private.student_verification_review(uuid,boolean,timestamptz) FROM authenticated;
CREATE FUNCTION filmverse_private.organization_block_invite_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM auth.users u JOIN public.user_blocks b ON
 ((b.user_id=NEW.invited_by AND b.blocked_user_id=u.id) OR (b.user_id=u.id AND b.blocked_user_id=NEW.invited_by))
 WHERE lower(u.email)=NEW.invited_email) THEN RAISE EXCEPTION 'invitation_unavailable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_block_invite BEFORE INSERT ON public.organization_invitations FOR EACH ROW EXECUTE FUNCTION filmverse_private.organization_block_invite_guard();
REVOKE ALL ON FUNCTION filmverse_private.organization_block_invite_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
