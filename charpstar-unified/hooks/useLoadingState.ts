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

  return {
    isLoading,
    startLoading,
    stopLoading,
    handleLinkClick,
    handleLinkComplete,
  };
}
