/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Photos live in IndexedDB/object storage as blob/object URLs, not remote hosts.
    unoptimized: true,
  },
};

export default nextConfig;
