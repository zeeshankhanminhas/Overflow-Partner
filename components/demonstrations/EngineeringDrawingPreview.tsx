export default function EngineeringDrawingPreview(){return <figure className="overflow-hidden border border-black/20 bg-white">
<div className="flex flex-wrap items-center justify-between gap-3 bg-[#17221b] px-5 py-4 text-white"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#ffad7c]">OP-DEMO-001 / D03</p><h3 className="mt-1 text-lg font-semibold">Preliminary dimensional interface study</h3></div><p className="text-xs uppercase tracking-widest text-white/65">Development / Uncontrolled</p></div>
<svg viewBox="0 0 1100 440" className="w-full" role="img" aria-label="CAD-derived preliminary schematic of D03 indexing rotor with nominal 160 millimetre diameter, four nominal ten millimetre holes on 120 millimetre pitch circle and 25 millimetre shaft">
<rect width="1100" height="440" fill="#fafbf9"/>
<text x="58" y="47" fontSize="16" fontWeight="700" fill="#183027">PLAN · ROTOR AND INDEX HOLES</text>
<text x="614" y="47" fontSize="16" fontWeight="700" fill="#183027">ELEVATION · SPINDLE INTERFACE</text>
<circle cx="280" cy="220" r="133" fill="none" stroke="#b95e2d" strokeWidth="3"/>
<circle cx="280" cy="220" r="20" fill="none" stroke="#2e4439" strokeWidth="2"/>
{[[280,120],[380,220],[280,320],[180,220]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="8" fill="#fff" stroke="#44574f" strokeWidth="2"/>)}
<circle cx="280" cy="220" r="100" fill="none" stroke="#9db0a2" strokeDasharray="6 7"/>
<path d="M147 367H413M147 356V379M413 356V379" stroke="#263c31" strokeWidth="2"/>
<text x="245" y="392" fontSize="17" fontWeight="600" fill="#243e31">Ø160</text>
<path d="M380 120L421 84H523" stroke="#263c31" fill="none" strokeWidth="2"/>
<text x="397" y="74" fontSize="14" fill="#263c31">4 × Ø10 on Ø120 PCD</text>
<rect x="690" y="168" width="200" height="95" fill="#f3f4f1" stroke="#30483b" strokeWidth="2"/>
<rect x="779" y="121" width="29" height="191" fill="#b2c0b8" stroke="#30483b" strokeWidth="2"/>
<rect x="735" y="173" width="118" height="22" fill="#9daea5" stroke="#30483b"/>
<rect x="735" y="226" width="118" height="22" fill="#9daea5" stroke="#30483b"/>
<rect x="645" y="166" width="295" height="20" fill="#efc5a9" stroke="#b95e2d" strokeWidth="2"/>
<rect x="755" y="113" width="78" height="9" fill="#aabbb1" stroke="#30483b"/>
<rect x="785" y="102" width="17" height="12" fill="#aabbb1" stroke="#30483b"/>
<path d="M891 238H989" stroke="#263c31" strokeWidth="2"/><text x="919" y="227" fontSize="14" fill="#263c31">Bearing envelope</text>
<path d="M807 289H980" stroke="#263c31" strokeWidth="2"/><text x="900" y="308" fontSize="14" fill="#263c31">Ø25 nominal spindle</text>
<path d="M935 179L974 142H1042" stroke="#263c31" fill="none" strokeWidth="2"/><text x="935" y="132" fontSize="14" fill="#263c31">Rotor 54–68</text>
<text x="55" y="420" fontSize="12" fill="#a04a20">NOMINAL DIMENSIONS ONLY · NO GD&T OR CONTROLLED MANUFACTURING RELEASE</text>
</svg>
<figcaption className="border-t border-black/15 bg-[#eef0ec] p-5 text-sm leading-6 text-black/65">CAD-derived development geometry presented as a preliminary technical schematic. Reference dimensions are nominal and cannot be used as production tolerances. No fit-stack verification or independent sign-off.</figcaption>
</figure>;}
