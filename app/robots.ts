import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://overflow-partner.vercel.app').replace(/\/$/, '');

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/workspace/', '/documents/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
