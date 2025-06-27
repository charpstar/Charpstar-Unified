import { useState, useCallback } from "react";
import { useLoading } from "@/contexts/LoadingContext";

interface UseLoadingStateOptions {
  showGlobalLoading?: boolean;
  loadingText?: string;
}

export function useLoadingState(options: UseLoadingStateOptions = {}) {
  const { showGlobalLoading = false, loadingText } = options;
  const [isLoading, setIsLoading] = useState(false);
  const { startLoading, stopLoading } = useLoading();

  const withLoading = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T> => {
      try {
        setIsLoading(true);
        if (showGlobalLoading) {
          startLoading();
        }
        return await asyncFn();
      } finally {
        setIsLoading(false);
        if (showGlobalLoading) {
          stopLoading();
        }
      }
    },
    [showGlobalLoading, startLoading, stopLoading]
  );

  return {
    isLoading,
    setIsLoading,
    withLoading,
  };
}
