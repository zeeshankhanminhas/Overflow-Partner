import type { Metadata } from 'next';
import Link from 'next/link';
import ProtectedDocumentEngine from '@/components/workspace/documents/ProtectedDocumentEngine';

export const metadata: Metadata = {
  title: 'Overflow Partner Workspace Documents',
  description: 'Protected Overflow Partner document engine.',
  robots: { index: false, follow: false },
};

export default async function WorkspaceDocumentsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const leadId = typeof params.lead === 'string' ? params.lead : null;
  const projectId = typeof params.project === 'string' ? params.project : null;

  return <>
    <div className="flex justify-end px-4 pt-4 md:px-8"><Link className="button secondary" href="/workspace/template-review">Review all templates</Link></div>
    <ProtectedDocumentEngine mode="index" leadId={leadId} projectId={projectId} query={params} />
  </>;
}
