import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProtectedDocumentEngine from '@/components/workspace/documents/ProtectedDocumentEngine';
import { getWorkspaceDocument, workspaceDocuments, type WorkspaceDocumentSlug } from '@/components/workspace/documents/documentRegistry';
import { buildDocumentAdapter } from '@/components/workspace/documents/documentAdapter';
import { requireUserContext } from '@/lib/auth/context';

export const metadata: Metadata = {
  title: 'Overflow Partner Workspace Document Preview',
  description: 'Protected Overflow Partner document engine preview.',
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return workspaceDocuments.map((document) => ({ document: document.slug }));
}

export default async function WorkspaceDocumentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ document: WorkspaceDocumentSlug }>;
  searchParams?: Promise<{ case?: string; project?: string; quote?: string }>;
}) {
  const { document } = await params;
  if (!getWorkspaceDocument(document)) notFound();
  const query = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const adapted = await buildDocumentAdapter(supabase, document, {
    organisationId,
    caseId: query.case,
    projectId: query.project,
    quoteId: query.quote,
  });
  return <ProtectedDocumentEngine mode="viewer" document={document} adapted={adapted} />;
}
