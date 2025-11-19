import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies as nextCookies } from "next/headers";

export const createServerClient = async (cookieStore?: any) => {
  // If cookieStore is not provided, fallback to next/headers (for server components)
  // In Next.js 15, cookies() must be awaited
  const cookiesInstance = cookieStore || (await nextCookies());
  
  return createServerComponentClient({
    cookies: () => cookiesInstance,
  });
};
