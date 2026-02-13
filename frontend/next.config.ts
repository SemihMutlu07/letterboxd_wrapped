// frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
    domains: ['image.tmdb.org'], // harmless even when unoptimized
  },
  // ❌ remove webpack() here
  async rewrites() {
    return [
      { source: '/ingest/array/:path*', destination: 'https://us-assets.i.posthog.com/array/:path*' },
      { source: '/ingest/:path*',        destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
};

export default nextConfig;
