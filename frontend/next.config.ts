// frontend/next.config.ts
import type { NextConfig } from 'next';

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8001';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8001',
        pathname: '/tmdb-proxy/**',
      },
    ],
  },
  async rewrites() {
    return [
      { source: '/tmdb-proxy/:path*',    destination: `${apiBase.replace(/\/$/, '')}/tmdb-proxy/:path*` },
      { source: '/ingest/array/:path*', destination: 'https://us-assets.i.posthog.com/array/:path*' },
      { source: '/ingest/:path*',        destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
};

export default nextConfig;
