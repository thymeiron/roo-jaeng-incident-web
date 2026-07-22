import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "incident_session";
const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://incident-api:8000";

function loginRedirect(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL("/login", request.url);

  if (pathname !== "/") {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }

  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/login") {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;

  if (!sessionToken) {
    return loginRedirect(request);
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        cookie: `${COOKIE_NAME}=${sessionToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return loginRedirect(request);
    }
  } catch {
    return loginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js).*)",
  ],
};
