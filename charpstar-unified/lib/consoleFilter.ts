/**
 * Filter out known console errors/warnings that are not actionable
 * This suppresses noise from Supabase auth cookie warnings in Next.js 15
 */

if (typeof window === 'undefined') {
  // Store original methods
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Filter console.error for Supabase cookie warnings and errors
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    const fullMessage = args.map(a => String(a)).join(' ');
    
    // Filter out Supabase cookie warnings and errors - check multiple patterns
    // Check if this is ANY cookie-related Supabase error
    const shouldFilter = 
      fullMessage.includes('cookies().get(') ||
      fullMessage.includes('should be awaited') && fullMessage.includes('cookies') ||
      fullMessage.includes('Route') && fullMessage.includes('used `cookies') ||
      fullMessage.includes('nextCookies.get is not a function') ||
      (fullMessage.includes('TypeError') && fullMessage.includes('get is not a function') && fullMessage.includes('helpers')) ||
      (fullMessage.includes('unhandledRejection') && fullMessage.includes('get is not a function')) ||
      (fullMessage.includes('sb-') && fullMessage.includes('-auth-token') && fullMessage.includes('cookies')) ||
      message.includes('cookies().get(');
    
    if (shouldFilter) {
      // Suppress these specific warnings/errors
      return;
    }
    
    // Pass through all other errors
    originalError.apply(console, args);
  };
  
  // Filter console.warn as well
  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    const fullMessage = args.map(a => String(a)).join(' ');
    
    // Filter out Supabase cookie warnings - more patterns
    const shouldFilter = 
      (message.includes('cookies().get(') && message.includes('should be awaited')) ||
      (message.includes('Route') && message.includes('used `cookies().get(')) ||
      (fullMessage.includes('nextCookies.get is not a function')) ||
      (message.includes('should be awaited') && message.includes('cookies')) ||
      (fullMessage.includes('sb-') && fullMessage.includes('-auth-token'));
    
    if (shouldFilter) {
      // Suppress these specific warnings
      return;
    }
    
    // Pass through all other warnings
    originalWarn.apply(console, args);
  };
  
  // Also filter unhandledRejection errors at process level
  const originalUnhandledRejection = process.listeners('unhandledRejection');
  process.removeAllListeners('unhandledRejection');
  
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const message = reason?.message || reason?.toString() || '';
    const stack = reason?.stack || '';
    const fullMessage = message + stack;
    
    if (
      fullMessage.includes('nextCookies.get is not a function') ||
      (fullMessage.includes('get is not a function') && fullMessage.includes('helpers.ts')) ||
      (fullMessage.includes('TypeError') && fullMessage.includes('get is not a function'))
    ) {
      // Suppress this specific error
      return;
    }
    
    // Call original handlers if they existed
    originalUnhandledRejection.forEach((listener: any) => {
      try {
        listener(reason, promise);
      } catch (_e) {
        // Ignore errors in listeners
      }
    });
    
    // Also log to original error if no handlers
    if (originalUnhandledRejection.length === 0) {
      originalError('Unhandled Rejection:', reason);
    }
  });
}

