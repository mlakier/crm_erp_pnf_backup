import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/crm", destination: "/customers", permanent: true },
      { source: "/crm/:path*", destination: "/customers/:path*", permanent: true },
      { source: "/entities", destination: "/subsidiaries", permanent: true },
      { source: "/entities/:path*", destination: "/subsidiaries/:path*", permanent: true },
      { source: "/estimates", destination: "/quotes", permanent: true },
      { source: "/estimates/:path*", destination: "/quotes/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
