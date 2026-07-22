import { cookies } from "next/headers";

const AUTH_COOKIE_NAME = "incident_session";

export const SERVER_API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://incident-api:8000";

export async function authenticatedApiFetch(
  path: string,
  init: RequestInit = {},
) {
  const sessionToken = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const headers = new Headers(init.headers);

  if (sessionToken) {
    headers.set("cookie", `${AUTH_COOKIE_NAME}=${sessionToken}`);
  }

  return fetch(`${SERVER_API_BASE}${path}`, {
    ...init,
    headers,
  });
}
