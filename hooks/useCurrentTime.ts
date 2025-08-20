import { useTimeOverride } from "@/contexts/TimeOverrideContext";

/**
 * Custom hook to get the current time (real or overridden)
 * 
 * Usage:
 * const currentTime = useCurrentTime();
 * 
 * This will return the real current time, or the overridden time
 * if a testTime parameter is present in the URL (development only)
 */
export function useCurrentTime(): Date {
  const { currentTime } = useTimeOverride();
  return currentTime;
}

/**
 * Custom hook to check if time is currently overridden
 */
export function useIsTimeOverridden(): boolean {
  const { isOverridden } = useTimeOverride();
  return isOverridden;
}
