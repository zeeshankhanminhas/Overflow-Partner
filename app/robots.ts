import type { MetadataRoute } from 'next';

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
    sitemap: 'https://midts.co.uk/sitemap.xml',
  };
}
