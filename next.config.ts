import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use static export for production builds (GitHub Pages)
  // In development, Next.js needs to run as a server
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  basePath: process.env.NODE_ENV === 'production' ? '/book_review' : '',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // Exclude mobile_app and packages directories from Next.js build
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    // Exclude mobile_app and packages from webpack compilation
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/mobile_app/**', '**/packages/**'],
    };
    return config;
  },
};

export default nextConfig;
