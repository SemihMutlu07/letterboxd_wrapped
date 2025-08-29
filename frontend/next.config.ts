// frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
    domains: ['image.tmdb.org'], // harmless even when unoptimized
  },
  // ❌ remove webpack() here
};

export default nextConfig;