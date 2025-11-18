/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@radix-ui/react-select", "@radix-ui/react-popover"],
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    // Exclude google-auth-library from client-side bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'google-auth-library': false,
      };
    }
    
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
