/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // This allows production builds to successfully complete even if there are type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
