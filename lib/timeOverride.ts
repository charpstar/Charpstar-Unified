/**
 * Time Override Utility
 * 
 * Allows overriding the current time for testing purposes using URL parameters.
 * Only works in development mode for security.
 * 
 * Usage:
 * - Normal: http://localhost:3000/dashboard
 * - Test future: http://localhost:3000/dashboard?testTime=2024-12-25
 * - Test specific time: http://localhost:3000/dashboard?testTime=2024-12-25T15:30:00
 */

let overrideTime: Date | null = null;

/**
 * Get the current time, either real or overridden
 */
export function getCurrentTime(): Date {
  if (overrideTime) {
    return new Date(overrideTime);
  }
  return new Date();
}

/**
 * Check if time override is active
 */
export function isTimeOverridden(): boolean {
  return overrideTime !== null;
}

/**
 * Get the override time if active
 */
export function getOverrideTime(): Date | null {
  return overrideTime;
}

/**
 * Set the override time
 */
export function setOverrideTime(time: Date | null): void {
  overrideTime = time;
}

/**
 * Parse and set override time from URL parameter
 * Only works in development mode
 */
export function parseTimeFromURL(): void {
  // Only allow in development mode
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const testTime = urlParams.get('testTime');
  
  if (testTime) {
    try {
      const parsedTime = new Date(testTime);
      if (!isNaN(parsedTime.getTime())) {
        overrideTime = parsedTime;
        console.log(`🕐 Time override active: ${parsedTime.toISOString()}`);
      } else {
        console.warn('Invalid testTime parameter:', testTime);
      }
    } catch (error) {
      console.warn('Failed to parse testTime parameter:', error);
    }
  } else {
    overrideTime = null;
  }
}

/**
 * Clear the time override
 */
export function clearTimeOverride(): void {
  overrideTime = null;
}
