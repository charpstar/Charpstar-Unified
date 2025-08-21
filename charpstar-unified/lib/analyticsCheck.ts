import { useUser } from "@/contexts/useUser";

interface AnalyticsProfile {
  datasetid: string;
  projectid: string;
  tablename: string;
  monitoredsince: string;
  name: string;
}

interface UseAnalyticsCheckResult {
  hasAnalyticsProfile: boolean;
  analyticsProfile: AnalyticsProfile | null;
  isLoading: boolean;
  error: string | null;
}

export function useAnalyticsCheck(): UseAnalyticsCheckResult {
  const user = useUser();
  const isUserLoading = typeof user === "undefined";

  // Handle loading state
  if (isUserLoading) {
    return {
      hasAnalyticsProfile: false,
      analyticsProfile: null,
      isLoading: true,
      error: null,
    };
  }

  // Handle unauthenticated state
  if (!user) {
    return {
      hasAnalyticsProfile: false,
      analyticsProfile: null,
      isLoading: false,
      error: "User not authenticated",
    };
  }

  // Handle missing metadata
  if (!user.metadata) {
    return {
      hasAnalyticsProfile: false,
      analyticsProfile: null,
      isLoading: false,
      error: "User profile is incomplete",
    };
  }

  // Handle missing analytics_profiles
  if (!user.metadata.analytics_profiles) {
    return {
      hasAnalyticsProfile: false,
      analyticsProfile: null,
      isLoading: false,
      error: "No analytics profiles configured",
    };
  }

  // Handle analytics_profiles as an object (not array)
  if (
    typeof user.metadata.analytics_profiles === "object" &&
    !Array.isArray(user.metadata.analytics_profiles)
  ) {
    const profile = user.metadata.analytics_profiles as AnalyticsProfile;
    if (profile.datasetid && profile.projectid) {
      return {
        hasAnalyticsProfile: true,
        analyticsProfile: profile,
        isLoading: false,
        error: null,
      };
    }
  }

  // Handle analytics_profiles as an array
  if (Array.isArray(user.metadata.analytics_profiles)) {
    if (user.metadata.analytics_profiles.length === 0) {
      return {
        hasAnalyticsProfile: false,
        analyticsProfile: null,
        isLoading: false,
        error: "No analytics profiles available",
      };
    }

    const firstProfile = user.metadata.analytics_profiles[0];
    if (firstProfile.datasetid && firstProfile.projectid) {
      return {
        hasAnalyticsProfile: true,
        analyticsProfile: firstProfile,
        isLoading: false,
        error: null,
      };
    }
  }

  // If we get here, the profile structure is invalid
  return {
    hasAnalyticsProfile: false,
    analyticsProfile: null,
    isLoading: false,
    error: "Analytics profile is missing required configuration",
  };
}
