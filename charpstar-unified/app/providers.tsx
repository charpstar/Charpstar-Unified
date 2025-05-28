// app/providers.tsx

"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { UserProvider } from "@/contexts/useUser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000, // 30 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
});

// Create a persister
const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
    return;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <UserProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {loading ? (
              <LoadingScreen />
            ) : (
              <>
                {children}
                <Toaster />
              </>
            )}
          </ThemeProvider>
        </UserProvider>
      </PersistQueryClientProvider>
    </QueryClientProvider>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex-1 overflow-hidden rounded-b-lg justify-center items-center bg-background">
        <SiteHeader />
        <main className="flex-1 space-y-4 p-8 pt-6 w-full bg-background">
          <div className="flex items-center justify-between space-y-2 mb-6">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-8 w-[100px]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[125px] w-full" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Skeleton className="col-span-4 h-[350px]" />
            <Skeleton className="col-span-3 h-[350px]" />
          </div>
        </main>
      </div>
    </div>
  );
}
