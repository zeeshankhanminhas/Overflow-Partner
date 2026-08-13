import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://overflow-partner.vercel.app').replace(/\/$/, '');

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/privacy', '/cookie-policy', '/terms'].map((pathname) => ({
    url: `${siteUrl}${pathname}`,
    lastModified: new Date(),
  }));
}
