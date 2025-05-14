import { createClient } from "@supabase/supabase-js";
import { withRoleProtection } from "@/lib/auth";
import { ROLES } from "@/lib/auth";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  profiles: {
    role: string;
  }[];
}

interface TransformedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

async function handler() {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select(
        `
        id,
        name,
        email,
        profiles:profiles(role)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Transform the data to match the expected format
    const transformedUsers: TransformedUser[] = (users as DatabaseUser[]).map(
      (user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.profiles[0]?.role || "user",
      })
    );

    return new Response(JSON.stringify(transformedUsers), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return new Response(JSON.stringify({ message: "Error fetching users" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Protect the endpoint with role-based middleware
export const GET = withRoleProtection(handler, ROLES.MANAGER);
