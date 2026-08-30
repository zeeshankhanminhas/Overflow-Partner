import type { ReactNode } from 'react';

type FileKind='pdf'|'cad'|'doc'|'sheet'|'image'|'archive'|'text'|'generic';

function extension(value:string){const clean=value.split('?')[0].split('#')[0];const match=clean.toLowerCase().match(/\.([a-z0-9]{1,8})$/);return match?.[1]||''}
function kindFor(value:string,documentType?:string|null):{kind:FileKind;label:string}{
  const ext=extension(value);
  if(['pdf'].includes(ext))return {kind:'pdf',label:'PDF'};
  if(['dwg','dxf','step','stp','iges','igs','ipt','iam','sldprt','sldasm','3dm','ifc'].includes(ext))return {kind:'cad',label:ext.toUpperCase()};
  if(['doc','docx','odt','rtf'].includes(ext))return {kind:'doc',label:ext.toUpperCase()};
  if(['xls','xlsx','csv','ods'].includes(ext))return {kind:'sheet',label:ext.toUpperCase()};
  if(['png','jpg','jpeg','webp','gif','svg','tif','tiff'].includes(ext))return {kind:'image',label:ext==='jpeg'?'JPG':ext.toUpperCase()};
  if(['zip','7z','rar','tar','gz'].includes(ext))return {kind:'archive',label:ext.toUpperCase()};
  if(['txt','md'].includes(ext))return {kind:'text',label:ext.toUpperCase()};
  const type=String(documentType||'').toLowerCase();
  if(type.includes('drawing')||type.includes('cad')||type.includes('technical'))return {kind:'cad',label:'CAD'};
  if(type.includes('quote')||type.includes('report')||type.includes('approval')||type.includes('requirements')||type.includes('scope')||type.includes('statement')||type.includes('register')||type.includes('handover')||type.includes('completion'))return {kind:'pdf',label:'PDF'};
  return {kind:'generic',label:'FILE'};
}

function glyph(kind:FileKind):ReactNode{
  if(kind==='cad')return <><path d="M8 8h8v8H8z"/><path d="M8 12h8M12 8v8"/></>;
  if(kind==='sheet')return <><path d="M8 8h8v8H8z"/><path d="M8 11h8M8 14h8M11 8v8"/></>;
  if(kind==='image')return <><circle cx="10" cy="10" r="1.5"/><path d="m8 16 3-3 2 2 2-2 2 3"/></>;
  if(kind==='archive')return <><path d="M10 7h4M10 9h4M10 11h4"/><path d="M9 13h6v4H9z"/></>;
  if(kind==='doc'||kind==='text')return <><path d="M9 9h6M9 12h6M9 15h4"/></>;
  if(kind==='pdf')return <><path d="M9 9h6M9 12h5M9 15h3"/></>;
  return <><path d="M9 10h6M9 13h6"/></>;
}

export default function FileTypeThumbnail({name='',documentType,className=''}:{name?:string|null;documentType?:string|null;className?:string}){
  const {kind,label}=kindFor(name||'',documentType);
  return <span className={`file-type-thumbnail file-type-thumbnail--${kind} ${className}`.trim()} aria-label={`${label} file`} title={`${label} file`}>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="file-type-thumbnail__page" d="M6.5 3.5h7l4 4v13h-11z"/>
      <path className="file-type-thumbnail__fold" d="M13.5 3.5v4h4"/>
      <g className="file-type-thumbnail__glyph">{glyph(kind)}</g>
    </svg>
    <span>{label}</span>
  </span>;
}
