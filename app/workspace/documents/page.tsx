import type { Metadata } from 'next';
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

  return <ProtectedDocumentEngine mode="index" leadId={leadId} projectId={projectId} query={params} />;
}
