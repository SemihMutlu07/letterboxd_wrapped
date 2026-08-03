import type { MetadataRoute } from 'next';

// Static export requires explicitly static data routes.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = 'https://movieswrapped.com';

  // Personal results pages must never be indexed — they contain a user's
  // private Letterboxd analysis. The rest of the site is open to everyone,
  // including AI answer-engine crawlers (AEO).
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/results', '/en/results', '/tr/results'],
      },
      // AI answer-engine / LLM crawlers — explicit allow (AEO). Results
      // pages stay disallowed for them too.
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'CCBot', 'cohere-ai', 'meta-externalagent', 'Bytespider', 'Applebot-Extended', 'Amazonbot', 'DuckAssistBot', 'YouBot', 'Googlebot', 'Bingbot'],
        allow: '/',
        disallow: ['/api/', '/results', '/en/results', '/tr/results'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
