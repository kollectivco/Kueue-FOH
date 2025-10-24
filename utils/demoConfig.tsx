/**
 * Demo Mode Configuration
 * Central configuration for demo mode behavior across the application
 */

export const DEMO_CONFIG = {
  // Timeout settings
  API_TIMEOUT: 3000, // 3 seconds
  HEALTH_CHECK_TIMEOUT: 2000, // 2 seconds
  RETRY_ATTEMPTS: 1, // Only retry once
  RETRY_DELAY: 500, // 500ms between retries

  // Feature flags
  ENABLE_DEMO_MODE: true, // Always start in demo mode
  SHOW_DEMO_INDICATORS: false, // Don't show "demo mode" badges
  AUTO_SWITCH_TO_REAL: true, // Auto switch when server available
  SILENT_ERRORS: true, // Suppress error notifications

  // Error suppression patterns
  SUPPRESS_ERROR_PATTERNS: [
    '404',
    'Network error',
    'Failed to fetch',
    'API call failed',
    'Connection failed',
    'timeout',
    'Request timeout',
    'Server unavailable',
    'Failed to refresh',
    'No production schema',
    'Schema not found',
    'Schema Status',
    'AbortError',
    'signal is aborted',
    'Server timeout',
    'demo mode',
    'Database schema',
    'Migration',
  ],

  // Console log settings
  VERBOSE_LOGGING: false, // Disable verbose API logs
  SHOW_DEMO_LOGS: false, // Don't show "demo mode active" logs
  SHOW_SUCCESS_LOGS: false, // Don't show success logs

  // UI settings
  SHOW_CONNECTION_STATUS: false, // Don't show connection indicators
  SHOW_SCHEMA_STATUS: false, // Don't show schema status
  SHOW_LOADING_SPINNERS: true, // Still show loading for UX
  QUICK_FAIL_TIMEOUT: 2000, // Fail fast for better UX
};

/**
 * Check if an error should be suppressed
 */
export function shouldSuppressError(errorMessage: string): boolean {
  if (!DEMO_CONFIG.SILENT_ERRORS) return false;

  return DEMO_CONFIG.SUPPRESS_ERROR_PATTERNS.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if a log should be shown
 */
export function shouldShowLog(logMessage: string, type: 'error' | 'warn' | 'info' = 'info'): boolean {
  if (type === 'error' && shouldSuppressError(logMessage)) {
    return false;
  }

  if (!DEMO_CONFIG.VERBOSE_LOGGING && logMessage.includes('API')) {
    return false;
  }

  if (!DEMO_CONFIG.SHOW_DEMO_LOGS && logMessage.toLowerCase().includes('demo mode')) {
    return false;
  }

  if (!DEMO_CONFIG.SHOW_SUCCESS_LOGS && logMessage.includes('✅')) {
    return false;
  }

  return true;
}

/**
 * Silent console wrapper that respects demo config
 */
export const silentConsole = {
  log: (...args: any[]) => {
    const message = args.join(' ');
    if (shouldShowLog(message, 'info')) {
      console.log(...args);
    }
  },

  error: (...args: any[]) => {
    const message = args.join(' ');
    if (shouldShowLog(message, 'error')) {
      console.error(...args);
    }
  },

  warn: (...args: any[]) => {
    const message = args.join(' ');
    if (shouldShowLog(message, 'warn')) {
      console.warn(...args);
    }
  },

  info: (...args: any[]) => {
    if (DEMO_CONFIG.VERBOSE_LOGGING) {
      console.info(...args);
    }
  },
};

/**
 * Safe fetch wrapper with demo mode support
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeout: number = DEMO_CONFIG.API_TIMEOUT
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    if (!shouldSuppressError(error.message)) {
      silentConsole.error('Fetch error:', error.message);
    }
    return null;
  }
}

/**
 * Demo data helpers
 */
export const DEMO_DATA = {
  // Empty arrays for when server is unavailable
  emptyReservations: [],
  emptyWaitlist: [],
  emptyGuests: [],
  emptyBranches: [],

  // Default demo organization
  defaultOrganization: {
    id: 'demo-org-1',
    name: 'Demo Restaurant',
    slug: 'demo-restaurant',
    logo: null,
  },

  // Default demo venue
  defaultVenue: {
    id: 'demo-venue-1',
    name: 'Main Location',
    capacity: 100,
  },
};

/**
 * Get demo mode status message (for debugging)
 */
export function getDemoStatus(): string {
  return `Demo Mode: ${DEMO_CONFIG.ENABLE_DEMO_MODE ? 'Active' : 'Inactive'} | Silent: ${DEMO_CONFIG.SILENT_ERRORS}`;
}
