/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'fnwrsbuebpbyafokrboi.supabase.co' },
    ],
  },
}

module.exports = nextConfig
