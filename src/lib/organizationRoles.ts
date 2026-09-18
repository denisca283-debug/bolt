const privileged = new Set(['owner', 'admin', 'finance']);
export function canOfferOrganizationRole(actorRole: string | undefined, targetRole: string, currentRole?: string, self = false, lastOwner = false) {
  if (!actorRole || self || lastOwner) return false;
  if (actorRole !== 'owner' && actorRole !== 'admin') return false;
  if (!currentRole && targetRole === 'owner') return false;
  return actorRole === 'owner' || (!privileged.has(targetRole) && !privileged.has(currentRole || ''));
}
