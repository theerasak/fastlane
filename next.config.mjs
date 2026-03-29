/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '**': ['./node_modules/pdfkit/js/data/**'],
  },
}

export default nextConfig
