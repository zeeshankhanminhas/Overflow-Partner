import type { Metadata } from 'next';
import ProtectedDocumentEngine from '@/components/workspace/documents/ProtectedDocumentEngine';

export const metadata: Metadata = {
  title: 'Overflow Partner Workspace Documents',
  description: 'Protected Overflow Partner document engine.',
  robots: { index: false, follow: false },
};

export default function WorkspaceDocumentsPage() {
  return <ProtectedDocumentEngine mode="index" />;
}
