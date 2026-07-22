import { cookies } from "next/headers";

export const SERVER_API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://incident-api:8000";

export async function authenticatedApiFetch(
  path: string,
  init: RequestInit = {},
) {
  const cookieStore = await cookies();
  const headers = new Headers(init.headers);

  headers.set("Cookie", cookieStore.toString());

  return fetch(`${SERVER_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
