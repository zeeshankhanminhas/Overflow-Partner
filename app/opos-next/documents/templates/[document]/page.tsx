import WorkspaceDocumentPreviewPage from '@/app/workspace/documents/templates/[document]/page';
import styles from './documentReview.module.css';

export { generateStaticParams, metadata } from '@/app/workspace/documents/templates/[document]/page';

export default async function OpDocumentReviewPage(props: Parameters<typeof WorkspaceDocumentPreviewPage>[0]) {
  return <div className={styles.review}><WorkspaceDocumentPreviewPage {...props} /></div>;
}
