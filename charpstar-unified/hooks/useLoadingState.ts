import { useCallback } from "react";
import { useLoading } from "@/contexts/LoadingContext";

export function useLoadingState() {
  const { startLoading, stopLoading, isLoading } = useLoading();

  const handleLinkClick = useCallback(() => {
    startLoading();
  }, [startLoading]);

  const handleLinkComplete = useCallback(() => {
    stopLoading();
  }, [stopLoading]);

  const withLoading = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T> => {
      try {
        startLoading();
        return await asyncFn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  return {
    isLoading,
    startLoading,
    stopLoading,
    handleLinkClick,
    handleLinkComplete,
    withLoading,
  };
}
