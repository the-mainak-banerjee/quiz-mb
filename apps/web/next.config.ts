import type { NextConfig } from 'next';
import { API_ORIGIN } from './src/lib/api/config';

void API_ORIGIN;
const config: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Generated screenshot filenames contain a content hash.
        source: '/landing/optimized/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
export default config;
