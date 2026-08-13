import type { ReactNode } from 'react';

export default function ProjectLayout({children}:{children:ReactNode}){
  // Project record navigation is owned by the workspace Current Record context.
  // Do not render a second set of tabs above the Project content.
  return <>{children}</>;
}
