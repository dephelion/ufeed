import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
