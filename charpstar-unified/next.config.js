/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@radix-ui/react-select", "@radix-ui/react-popover"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
  images: {
    domains: [
      "drive.charpstar.net",
      "cdn.charpstar.net",
      "tpamckewerybqzhhhqqp.supabase.co",
      "localhost",
      "res.cloudinary.com",
    ],
  },
};

module.exports = nextConfig;
