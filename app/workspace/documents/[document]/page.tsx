import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProtectedDocumentEngine from '@/components/workspace/documents/ProtectedDocumentEngine';
import { getWorkspaceDocument, workspaceDocuments, type WorkspaceDocumentSlug } from '@/components/workspace/documents/documentRegistry';

export const metadata: Metadata = {
  title: 'Overflow Partner Workspace Document Preview',
  description: 'Protected Overflow Partner document engine preview.',
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return workspaceDocuments.map((document) => ({ document: document.slug }));
}

export default async function WorkspaceDocumentPreviewPage({ params }: { params: Promise<{ document: WorkspaceDocumentSlug }> }) {
  const { document } = await params;
  if (!getWorkspaceDocument(document)) notFound();
  return <ProtectedDocumentEngine mode="viewer" document={document} />;
}
