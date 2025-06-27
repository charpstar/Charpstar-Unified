// app/providers.tsx

"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/feedback";
import { UserProvider } from "@/contexts/useUser";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, Suspense } from "react";

// Create a persister
const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 30 * 60 * 1000, // 30 minutes
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <Suspense fallback={null}>
          <LoadingProvider>
            <UserProvider>
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
          </LoadingProvider>
        </Suspense>
      </PersistQueryClientProvider>
    </QueryClientProvider>
  );
}
