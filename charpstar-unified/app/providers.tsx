// app/providers.tsx

"use client";

import { useEffect, useState, useRef } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { UserProvider } from "@/contexts/useUser";
import { supabase } from "@/lib/supabaseClient";
import { getUserWithMetadata } from "@/supabase/getUser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use a ref so the QueryClient instance stays the same
  const queryClientRef = useRef<QueryClient>(new QueryClient());
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUserWithMetadata(supabase);
        setUser(userData);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <UserProvider user={user}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
