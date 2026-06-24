import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security Proxy: Gates the control panel and all admin API routes.
 *
 * - On the CUSTOMER site (ENABLE_ADMIN is NOT set): all admin routes
 *   return a genuine 404, making the control panel completely invisible.
 * - On the ADMIN site (ENABLE_ADMIN=true, runs on a different port/domain):
 *   admin routes are accessible normally.
 *
 * This ensures full route-level isolation between the two deployments.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute =
    pathname.startsWith("/control-panel-x7k9") ||
    pathname.startsWith("/api/client-admin") ||
    pathname.startsWith("/api/admin");

  if (isAdminRoute) {
    const adminEnabled = process.env.ENABLE_ADMIN === "true";
    if (!adminEnabled) {
      // Return a genuine 404 — don't reveal that the route exists
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/control-panel-x7k9/:path*", "/api/client-admin/:path*", "/api/admin/:path*"],
};
