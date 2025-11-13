"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

// Configure NProgress for instant startup
NProgress.configure({
  showSpinner: false,
  minimum: 0.08, // Lower minimum for faster appearance
  easing: "ease",
  speed: 400, // Faster animation
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
  const router = useRouter();

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

  // Intercept link clicks to start loading immediately
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (
        link &&
        link.href &&
        link.href.startsWith(window.location.origin) &&
        !link.href.includes("#") &&
        !link.target &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        // Start loading immediately on link click
        startLoading();
      }
    };

    // Intercept Next.js Link clicks (data-nextjs-router-link attribute)
    const handleNextLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const nextLink = target.closest("[data-nextjs-router-link]");

      if (nextLink) {
        // Start loading immediately on Next.js Link click
        startLoading();
      }
    };

    // Intercept form submissions that might lead to navigation
    const handleFormSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement;
      if (
        form &&
        form.action &&
        form.action.startsWith(window.location.origin)
      ) {
        // Start loading on form submission
        startLoading();
      }
    };

    // Intercept navigation events
    const handleBeforeUnload = () => {
      startLoading();
    };

    // Add event listeners
    document.addEventListener("click", handleLinkClick);
    document.addEventListener("click", handleNextLinkClick);
    document.addEventListener("submit", handleFormSubmit);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("click", handleLinkClick);
      document.removeEventListener("click", handleNextLinkClick);
      document.removeEventListener("submit", handleFormSubmit);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Intercept programmatic navigation via router.push
  useEffect(() => {
    // Store the original push method
    const originalPush = router.push;

    // Override the push method to start loading
    router.push = function (...args: Parameters<typeof originalPush>) {
      startLoading();
      return originalPush.apply(router, args);
    };

    // Restore the original method on cleanup
    return () => {
      router.push = originalPush;
    };
  }, [router]);

  // Handle route changes
  useEffect(() => {
    // Stop loading when route change is complete
    const timer = setTimeout(() => {
      stopLoading();
    }, 100); // Shorter delay for faster completion

    return () => {
      clearTimeout(timer);
    };
  }, [pathname, searchParams]);

  // Handle initial page load
  useEffect(() => {
    // Stop loading after initial page load
    const timer = setTimeout(() => {
      stopLoading();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

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
