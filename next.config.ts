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
};

export default nextConfig;
