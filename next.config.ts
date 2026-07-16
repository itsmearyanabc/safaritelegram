import type { NextConfig } from "next";

const isAdmin = process.env.ENABLE_ADMIN === "true";

const nextConfig: NextConfig = {
  // Use a separate build directory for the admin site to allow running
  // both customer and admin dev servers simultaneously from the same project
  distDir: isAdmin ? ".next-admin" : ".next",

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },

  // Disable powered-by header
  poweredByHeader: false,
};

export default nextConfig;
