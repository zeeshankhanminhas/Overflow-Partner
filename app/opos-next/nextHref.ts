/** Redirect recognised canonical record links to new read-only OPOS views. All
 * unrecognised or action-only links stay governed by their original handlers. */
export function nextHref(href: string) {
  const matchers: Array<[RegExp, string]> = [
    [/^\/workspace\/acquisition\/([0-9a-f-]{36})(?:\?.*)?$/i, '/opos-next/opportunities/'],
    [/^\/workspace\/leads\/([0-9a-f-]{36})(?:\?.*)?$/i, '/opos-next/cases/'],
    [/^\/workspace\/projects\/([0-9a-f-]{36})(?:\?.*)?$/i, '/opos-next/projects/'],
    [/^\/outreach\/([0-9a-f-]{36})(?:\?.*)?$/i, '/opos-next/outreach/'],
  ];
  for (const [pattern,target] of matchers) {
    const match=href.match(pattern);
    if(match)return target+match[1];
  }
  if(href==='/workspace/acquisition'||href==='/workspace/acquisition/prospects')return '/opos-next/opportunities';
  if(href==='/workspace/leads')return '/opos-next/cases';
  if(href==='/workspace/projects')return '/opos-next/projects';
  if(href==='/workspace/payments')return '/opos-next/finance';
  if(href==='/workspace/partners')return '/opos-next/partners';
  if(href==='/workspace/documents')return '/opos-next/documents';
  if(href==='/outreach')return '/opos-next/outreach';
  return href;
}
