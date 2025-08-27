/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  webpack: (config: any) => {
    // Ensure the alias is set correctly
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    config.resolve.alias['@'] = require('path').resolve(__dirname, 'src');
    
    return config;
  },
};

module.exports = nextConfig;