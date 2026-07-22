import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "incident_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isLoginPage = pathname === "/login";
  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;

  if (isLoginPage) {
    return NextResponse.next();
  }

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);

    if (pathname !== "/") {
      loginUrl.searchParams.set(
        "next",
        `${pathname}${search}`,
      );
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js).*)",
  ],
};
