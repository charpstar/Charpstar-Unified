import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createClient } from "@supabase/supabase-js";
import { compare } from "bcrypt";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // First, fetch the user
          const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, name, email, password")
            .eq("email", credentials.email)
            .single();

          if (userError || !user) {
            console.error("Error fetching user:", userError);
            return null;
          }

          // Compare passwords
          const passwordMatch = await compare(
            credentials.password,
            user.password
          );
          if (!passwordMatch) {
            console.error("Password does not match");
            return null;
          }

          // Then fetch the profile separately
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .single();

          if (profileError) {
            console.error("Error fetching profile:", profileError);
            // Don't fail login if profile fetch fails, just use default role
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: profile?.role || "user",
          };
        } catch (error) {
          console.error("Authorization error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
    signOut: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  debug: true, // Enable debug messages for development
});

export { handler as GET, handler as POST };
