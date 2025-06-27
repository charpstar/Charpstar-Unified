"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { usePathname, useSearchParams } from "next/navigation";

// Configure NProgress with better visibility
NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
  easing: "ease",
  speed: 800,
  trickleSpeed: 200,
  trickle: true,
});

interface LoadingContextType {
  startLoading: () => void;
  stopLoading: () => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Start loading
  const startLoading = () => {
    setIsLoading(true);
    NProgress.start();
  };

  // Stop loading
  const stopLoading = () => {
    setIsLoading(false);
    NProgress.done();
  };

  // Handle route changes
  useEffect(() => {
    startLoading();

    // Longer delay to ensure the loading bar is visible
    const timer = setTimeout(() => {
      stopLoading();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopLoading();
    };
  }, [pathname, searchParams]);

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading, isLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}
