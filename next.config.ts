import type { NextConfig } from 'next'

const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co').hostname

const nextConfig: NextConfig = {
  images: {
    // Some local networks reach Supabase through NAT64 (64:ff9b::/96), which the image
    // optimizer treats as a private IP. Only relaxed in development; production is unaffected.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }],
  },
}

export default nextConfig
