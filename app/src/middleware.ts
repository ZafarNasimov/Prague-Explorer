import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    console.log("[MIDDLEWARE] api route — passing through:", path);
    return NextResponse.next();
  }

  console.log("[MIDDLEWARE] non-api route — applying intl middleware:", path);
  return intlMiddleware(req);
}

export const config = {
  // Match all routes except Next.js internals and static files
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
