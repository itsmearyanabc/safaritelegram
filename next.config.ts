import type { NextConfig } from "next";

const isAdmin = process.env.ENABLE_ADMIN === "true";

const nextConfig: NextConfig = {
  // Use a separate build directory for the admin site to allow running
  // both customer and admin dev servers simultaneously from the same project
  distDir: isAdmin ? ".next-admin" : ".next",
};

export default nextConfig;
