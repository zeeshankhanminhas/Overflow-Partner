import type { SVGProps } from 'react';

export type WorkspaceIconName = 'add' | 'work' | 'alerts' | 'close' | 'check' | 'info' | 'error' | 'arrow';

export default function WorkspaceIcon({ name, size = 18, ...props }: { name: WorkspaceIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };

  if (name === 'add') return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/></svg>;
  if (name === 'work') return <svg {...common}><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h3M14 13h2M8 16h8"/></svg>;
  if (name === 'alerts') return <svg {...common}><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 6 2.5 6 2.5 6H4s2.5 0 2.5-6"/><path d="M10 19h4"/></svg>;
  if (name === 'close') return <svg {...common}><path d="m7 7 10 10M17 7 7 17"/></svg>;
  if (name === 'check') return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.3 2.3 4.9-5"/></svg>;
  if (name === 'info') return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>;
  if (name === 'error') return <svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>;
  return <svg {...common}><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></svg>;
}
