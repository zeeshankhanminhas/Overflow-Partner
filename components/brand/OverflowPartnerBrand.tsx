type BrandProps = { compact?: boolean; className?: string };

export function OverflowPartnerMark({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <path d="M8 13h22a9 9 0 0 1 9 9v8a9 9 0 0 1-9 9H17a9 9 0 0 1-9-9V13Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M25 22h20a11 11 0 0 1 0 22H25V22Zm0 0v30" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" strokeLinejoin="round" />
  </svg>;
}

export default function OverflowPartnerBrand({ compact = false, className = '' }: BrandProps) {
  return <span className={`op-identity ${compact ? 'op-identity--compact' : ''} ${className}`.trim()}>
    <OverflowPartnerMark className="op-identity__mark" />
    {!compact ? <span className="op-identity__name"><span>Overflow</span><span>Partner</span></span> : null}
  </span>;
}
