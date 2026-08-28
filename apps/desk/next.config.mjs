/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: false,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: '25mb' } },
}
