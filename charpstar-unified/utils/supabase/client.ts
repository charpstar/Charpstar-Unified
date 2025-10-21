import { supabase } from "@/lib/supabaseClient";

export const createClient = () => {
  return supabase;
};
