/**
 * Utility functions for generating URLs across the application
 */

/**
 * Get the base URL for the application
 * Uses environment variables with proper fallbacks for production
 */
export function getBaseUrl(): string {
  // First priority: NEXT_PUBLIC_SITE_URL (set in Vercel)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // Second priority: NEXT_PUBLIC_BASE_URL (alternative env var)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Third priority: Vercel URL (automatically set by Vercel)
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`;
  }

  // Fallback based on environment
  if (process.env.NODE_ENV === "production") {
    return "https://platform.charpstar.co";
  }

  // Development fallback
  return "http://localhost:3000";
}

/**
 * Get the reset password URL
 */
export function getResetPasswordUrl(): string {
  return `${getBaseUrl()}/reset-password`;
}

/**
 * Get the signup URL with token
 */
export function getSignupUrl(token: string): string {
  return `${getBaseUrl()}/auth/signup?token=${token}`;
}

/**
 * Get the dashboard URL
 */
export function getDashboardUrl(): string {
  return `${getBaseUrl()}/dashboard`;
}

/**
 * Get the auth URL
 */
export function getAuthUrl(): string {
  return `${getBaseUrl()}/auth`;
}
