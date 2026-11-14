export default function StudySketch({roller=false}:{roller?:boolean}){
 return <div className="relative overflow-hidden bg-[#14201b] p-6 sm:p-10">
  <div className="absolute inset-0 opacity-20" style={{backgroundImage:'linear-gradient(#8da899 1px,transparent 1px),linear-gradient(90deg,#8da899 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>
  <svg className="relative w-full" viewBox="0 0 600 340" role="img" aria-label={roller?'Illustrative roller-support diagram':'Illustrative indexing fixture diagram'} fill="none" strokeLinecap="round" strokeLinejoin="round">
   <g stroke="#aac4b6" strokeWidth="3">
   {roller ? <>
    <path d="M96 269 L306 314 L508 265 L299 222 Z" fill="#2d4c40"/><path d="M117 253v-135l38-13v143M452 253V117l38-13v143" stroke="#d5dedd" strokeWidth="12"/>
    <path d="M156 158L452 158" stroke="#f58c50" strokeWidth="32"/><path d="M140 158L468 158" stroke="#d5dedd" strokeWidth="7"/>
    <circle cx="150" cy="158" r="12" fill="#14201b"/><circle cx="455" cy="158" r="12" fill="#14201b"/>
   </> : <>
    <path d="M79 269L301 326L528 266L306 204Z" fill="#2d4c40"/>
    <ellipse cx="305" cy="175" rx="108" ry="37" fill="#3e5d4f"/><path d="M197 175v35c0 50 216 50 216 0v-35" fill="#263d32"/>
    <ellipse cx="305" cy="175" rx="108" ry="37"/><ellipse cx="305" cy="175" rx="40" ry="14" stroke="#f58c50"/>
    <path d="M118 224l95-31 16 26-90 37zM394 194l87 27-17 34-92-37z" fill="#d5dedd"/>
    <path d="M88 250l84-31M512 248l-80-28" stroke="#f58c50" strokeWidth="8"/>
   </>}
   </g>
  </svg>
  <p className="relative mt-2 text-xs font-semibold uppercase tracking-[.15em] text-white/70">Illustrative technical schematic · not a verified CAD render</p>
 </div>;
}
