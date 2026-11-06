/** QA presentation routing only; not an authority or an alternate action. */
const exact: Readonly<Record<string,string>>=Object.freeze({
 '/workspace':'/opos-next',
 '/workspace/projects':'/opos-next/projects',
 '/workspace/partners':'/opos-next/partners',
 '/workspace/tasks':'/opos-next/tasks',
 '/workspace/notifications':'/opos-next/notifications',
 '/workspace/documents':'/opos-next/documents',
});
export function canonicalQaWorkspace2Path(pathname:string):string|null{
 const clean=pathname.endsWith('/')&&pathname.length>1?pathname.slice(0,-1):pathname;
 if(Object.prototype.hasOwnProperty.call(exact,clean))return exact[clean];
 const parts=clean.split('/').filter(Boolean);
 const safe=(s:string)=>/^[a-z0-9_-]+$/i.test(s);
 if(parts.length===3&&parts[0]==='workspace'&&parts[1]==='projects'&&safe(parts[2]))
  return '/opos-next/projects/'+parts[2];
 if(parts.length===4&&parts[0]==='workspace'&&parts[1]==='documents'&&parts[2]==='templates'&&safe(parts[3]))
  return '/opos-next/documents/templates/'+parts[3];
 if(parts.length===3&&parts[0]==='workspace'&&parts[1]==='documents'&&safe(parts[2]))
  return '/opos-next/documents/'+parts[2];
 return null; // Never reroute protected token flows or non-equivalent actions.
}
