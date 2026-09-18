BEGIN;
ALTER TABLE public.organization_promotions ADD CONSTRAINT promotion_org_identity UNIQUE(organization_id,id);
ALTER TABLE public.organization_campaign_daily_metrics ADD CONSTRAINT metrics_same_org
 FOREIGN KEY(organization_id,promotion_id) REFERENCES public.organization_promotions(organization_id,id) ON DELETE CASCADE;
ALTER TABLE public.profile_publications ADD CONSTRAINT resume_availability_bounded CHECK(length(availability)<=200);
CREATE OR REPLACE FUNCTION filmverse_private.professional_directory(p_query text,p_department uuid,p_profession uuid,p_availability text,p_offset int) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(r)),'[]') FROM (
 SELECT p.id AS "userId",p.public_slug AS slug,p.full_name AS name,p.city,p.avatar_url AS "avatarUrl",
 CASE p.availability_status WHEN 'busy' THEN 'Занят' WHEN 'limited' THEN 'Ограниченно' ELSE 'Свободен' END AS availability,
 pr.id AS "professionId",pr.name AS "professionName",pr.department_id AS "departmentId",up.experience_years AS "experienceYears",
 ARRAY(SELECT s.name FROM public.user_skills us JOIN public.skills s ON s.id=us.skill_id WHERE us.user_id=p.id AND s.is_active LIMIT 50) AS skills
 FROM public.profiles p JOIN public.user_professions up ON up.user_id=p.id AND up.is_primary
 JOIN public.professions pr ON pr.id=up.profession_id
 WHERE filmverse_private.person_discoverable(p.id)
 AND (p_department IS NULL OR pr.department_id=p_department) AND (p_profession IS NULL OR pr.id=p_profession)
 AND (p_availability='' OR p.availability_status=p_availability)
 AND (p_query='' OR concat_ws(' ',p.full_name,p.city,pr.name) ILIKE '%'||left(p_query,120)||'%')
 ORDER BY p.full_name,p.id LIMIT 24 OFFSET greatest(0,least(p_offset,10000))) r
$$;
COMMIT;
