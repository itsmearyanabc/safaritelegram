import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security Proxy: Gates the control panel and all admin API routes.
 *
 * Admin lives on the same deployment as the customer site.
 * Routes are enabled by default; set ENABLE_ADMIN=false to hide them
 * (e.g. a customer-only mirror deploy).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute =
    pathname.startsWith("/control-panel-x7k9") ||
    pathname.startsWith("/api/client-admin") ||
    pathname.startsWith("/api/admin");

  if (isAdminRoute && process.env.ENABLE_ADMIN === "false") {
    // Return a genuine 404 — don't reveal that the route exists
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/control-panel-x7k9/:path*", "/api/client-admin/:path*", "/api/admin/:path*"],
};
