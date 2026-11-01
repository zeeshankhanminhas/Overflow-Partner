/** Keep canonical priority and exception links inside the modern operating shell.
 * Unknown destinations are left unchanged rather than silently misrouting a decision.
 */
export function nextHref(href:string){
 if(href.startsWith('/opos-next'))return href;
 let url:URL;
 try{url=new URL(href,'https://opos.internal');}catch{return href;}
 if(url.origin!=='https://opos.internal')return href;
 const path=url.pathname;
 const records:Array<[RegExp,string]>=[
   [/^\/workspace\/companies\/([0-9a-f-]{36})\/?$/i,'/opos-next/accounts/'],
   [/^\/workspace\/acquisition\/([0-9a-f-]{36})\/?$/i,'/opos-next/opportunities/'],
   [/^\/workspace\/leads\/([0-9a-f-]{36})\/?$/i,'/opos-next/cases/'],
   [/^\/workspace\/projects\/([0-9a-f-]{36})\/?$/i,'/opos-next/projects/'],
   [/^\/workspace\/projects\/([0-9a-f-]{36})\/(?:delivery|execution)\/?$/i,'/opos-next/projects/'],
   [/^\/outreach\/([0-9a-f-]{36})\/?$/i,'/opos-next/outreach/'],
 ];
 for(const [pattern,target] of records){const match=path.match(pattern);if(match)return target+match[1];}
 if(path.startsWith('/workspace/documents/templates/')){
   const id=url.searchParams.get('document_record')||'';
   return /^[0-9a-f-]{36}$/i.test(id)?'/opos-next/documents/'+id:'/opos-next/documents';
 }
 const registers:Record<string,string>={
   '/workspace/companies':'/opos-next/accounts',
   '/workspace/acquisition':'/opos-next/opportunities',
   '/workspace/acquisition/prospects':'/opos-next/opportunities',
   '/workspace/leads':'/opos-next/cases',
   '/workspace/projects':'/opos-next/projects',
   '/workspace/payments':'/opos-next/finance',
   '/workspace/commercial-control':'/opos-next/finance',
   '/workspace/partners':'/opos-next/partners',
   '/workspace/documents':'/opos-next/documents',
   '/workspace/notifications':'/opos-next/notifications',
   '/workspace/tasks':'/opos-next/tasks',
   '/outreach':'/opos-next/outreach',
 };
 return registers[path]||href;
}
