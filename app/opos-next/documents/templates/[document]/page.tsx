import { permanentRedirect } from 'next/navigation';
import WorkspaceDocumentPreviewPage from '@/app/workspace/documents/templates/[document]/page';
import { legacyDocumentAliases } from '@/components/workspace/documents/documentRegistry';
import styles from './documentReview.module.css';

export { generateStaticParams, metadata } from '@/app/workspace/documents/templates/[document]/page';

export default async function OpDocumentReviewPage(props: Parameters<typeof WorkspaceDocumentPreviewPage>[0]) {
  const {document}=await props.params;
  const canonical=legacyDocumentAliases[document];
  if(canonical){
    const query=props.searchParams?await props.searchParams:{};
    const preserved=new URLSearchParams(Object.entries(query).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
    permanentRedirect(`/opos-next/documents/templates/${canonical}${preserved.size?`?${preserved}`:''}`);
  }
  return <div className={styles.review}><WorkspaceDocumentPreviewPage {...props} /></div>;
}
