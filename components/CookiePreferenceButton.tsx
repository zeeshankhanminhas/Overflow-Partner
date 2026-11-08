'use client';
export default function CookiePreferenceButton(){return <button type="button" className="w-fit text-left text-sm text-white hover:text-[#ff9c65]" onClick={()=>window.dispatchEvent(new Event('overflow:cookie-preferences'))}>Cookie preferences</button>}
