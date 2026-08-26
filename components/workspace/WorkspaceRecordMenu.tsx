'use client';

import Link from 'next/link';
import { WorkspacePopover } from './WorkspacePopover';

type RecordLink = {
  label: string;
  href: string;
  detail?: string;
};

export function WorkspaceRecordMenu({
  label = 'More actions',
  links,
  align = 'end',
}: {
  label?: string;
  links: RecordLink[];
  align?: 'start' | 'end';
}) {
  if (!links.length) return null;

  return <WorkspacePopover
    align={align}
    label={label}
    trigger={<span className="workspace-record-menu__trigger">More ···</span>}
  >
    <div className="workspace-record-menu">
      {links.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href}>
        <span>{item.label}</span>
        {item.detail ? <small>{item.detail}</small> : null}
      </Link>)}
    </div>
  </WorkspacePopover>;
}

export function WorkspaceContextLinks({
  title = 'Related work',
  links,
}: {
  title?: string;
  links: RecordLink[];
}) {
  if (!links.length) return null;
  return <div className="workspace-context-links">
    <small>{title}</small>
    <div>{links.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href}>
      <span><strong>{item.label}</strong>{item.detail ? <em>{item.detail}</em> : null}</span>
      <b aria-hidden="true">→</b>
    </Link>)}</div>
  </div>;
}
