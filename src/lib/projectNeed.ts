export type ProjectNeedTarget = 'person'|'casting_subject'|'organization'|'equipment'|'package'|'location'|'transport'|'service'|'postproduction'|'other';
export type ResolutionRoute = 'professional_proposal'|'casting'|'young_talent_casting'|'equipment_sourcing'|'company_rfp'|'provider_sourcing'|'manual';
export type ProjectNeed = Readonly<{id:string;projectId:string;title:string;targetType:ProjectNeedTarget;resolutionRoute:ResolutionRoute;status:'open'|'in_progress'|'resolved'|'cancelled';quantity:number;budgetMinor:string|null;currency:string|null}>;
export function resolveNeed(target:ProjectNeedTarget, minor=false):ResolutionRoute{
 if(minor&&target!=='casting_subject')throw new Error('minor_requires_casting_subject');
 switch(target){case 'casting_subject':return minor?'young_talent_casting':'casting';case 'person':return 'professional_proposal';case 'equipment':case 'package':return 'equipment_sourcing';case 'organization':case 'postproduction':return 'company_rfp';case 'transport':case 'location':case 'service':return 'provider_sourcing';default:return 'manual';}
}
// Manual workspace, student guided mode and AI must persist the same project_needs row.
// No full Crew Builder, automatic booking, private identity import or numerical match score.
