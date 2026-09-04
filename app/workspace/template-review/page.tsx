import type { Metadata } from 'next';
import { requireUserContext } from '@/lib/auth/context';
import { lifecycleEmailScenarios } from '@/lib/notifications/scenarios';
import { workspaceDocuments } from '@/components/workspace/documents/documentRegistry';
import { documentLanguage } from '@/components/workspace/documents/documentLanguage';
import TemplateReviewCentre from '@/components/workspace/templates/TemplateReviewCentre';
import './template-review.css';

export const metadata: Metadata = {
  title: 'Template Review Centre · Overflow Partner',
  description: 'Protected review centre for controlled documents and business communications.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function TemplateReviewPage() {
  await requireUserContext();

  const emails = Object.entries(lifecycleEmailScenarios).map(([scenario, definition]) => ({
    scenario,
    ...definition,
  }));
  const documents = workspaceDocuments.map((document) => {
    const language = documentLanguage[document.slug];
    return {
      ...document,
      audience: language.audience,
      visibility: language.visibility,
      issueCondition: language.issueCondition,
      purpose: language.purpose,
    };
  });

  return <TemplateReviewCentre emails={emails} documents={documents} />;
}
