import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace Login | Overflow Partner',
  description: 'Secure access to the Overflow Partner operations workspace.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
