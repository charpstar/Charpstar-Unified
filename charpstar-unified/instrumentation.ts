/**
 * Next.js instrumentation hook - runs before any code executes
 * This ensures our console filter is loaded as early as possible
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Load console filter at the earliest possible moment
    require('./lib/consoleFilter');
  }
}

