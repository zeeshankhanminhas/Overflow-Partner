/**
 * The redesign is a presentation layer over existing governed server actions.
 * Only an explicit hidden flag can return the result to the known vNext route;
 * IDs are taken from the server-validated action context and paths are fixed.
 * Untrusted FormData cannot choose arbitrary redirect destinations.
 */
export function acquisitionReturn(formData: FormData, prospectId: string, legacyDestination: string) {
  if (formData.get('opos_next') !== '1' || !/^[0-9a-f-]{36}$/i.test(prospectId)) return legacyDestination;
  const legacy = new URL(legacyDestination, 'https://opos.invalid');
  const target = new URL('/opos-next/opportunities/' + prospectId, 'https://opos.invalid');
  for (const key of ['error','partnerReviewCreated','partnerDecision','notificationWarning','updated']) {
    const value = legacy.searchParams.get(key);
    if (value) target.searchParams.set(key, value.slice(0,500));
  }
  if (!target.searchParams.has('error')) target.searchParams.set('updated','1');
  return target.pathname + target.search;
}

export function caseReturn(formData: FormData, leadId: string, legacyDestination: string) {
  return formData.get('opos_next') === '1' && /^[0-9a-f-]{36}$/i.test(leadId)
    ? '/opos-next/cases/' + leadId + '?converted=1' : legacyDestination;
}
