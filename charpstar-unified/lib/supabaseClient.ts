import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// Single client instance to avoid multiple GoTrueClient instances
export const supabase = createClientComponentClient();
