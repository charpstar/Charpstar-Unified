import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies as nextCookies } from "next/headers";

export const createServerClient = (cookieStore?: any) => {
  // If cookieStore is not provided, fallback to next/headers (for server components)
  return createServerComponentClient({
    cookies: () => cookieStore || nextCookies(),
  });
};
