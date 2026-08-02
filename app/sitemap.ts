import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://overflowpartner.co.uk';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '',
    '/privacy/',
    '/cookie-policy/',
    '/terms/',
    '/login/',
    '/step-2/',
    '/quote/',
    '/quote-acceptance/',
    '/vendor-pricing/',
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));
}
