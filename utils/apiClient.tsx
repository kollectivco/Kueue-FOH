import { projectId, publicAnonKey } from './supabase/info';
import { DEMO_CONFIG, shouldSuppressError, silentConsole } from './demoConfig';

// API Client with timeout, retry, and demo fallback
export interface ApiOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  fallbackToDemo?: boolean;
  silent?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isDemoMode?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number = 3000; // 3 seconds max
  private defaultRetries: number = 1; // Only retry once
  private demoMode: boolean = false;

  constructor() {
    this.baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-6eefa08e`;
    this.defaultTimeout = DEMO_CONFIG.API_TIMEOUT;
    this.defaultRetries = DEMO_CONFIG.RETRY_ATTEMPTS;
    this.demoMode = DEMO_CONFIG.ENABLE_DEMO_MODE;
  }

  /**
   * Make API request with timeout and retry logic
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit & ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = 500,
      fallbackToDemo = true,
      silent = false,
      ...fetchOptions
    } = options;

    let lastError: Error | null = null;

    // Try the request with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...fetchOptions,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            ...fetchOptions.headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Success - mark server as available
        this.demoMode = false;
        
        return {
          success: true,
          data,
          isDemoMode: false,
        };

      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (!silent && !shouldSuppressError(error.message)) {
          if (error.name === 'AbortError' || error.message.includes('timeout')) {
            silentConsole.log(`⏱️ Request timeout (${timeout}ms) on attempt ${attempt + 1}`);
          } else {
            silentConsole.log(`🔄 Request failed on attempt ${attempt + 1}:`, error.message);
          }
        }

        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed - fall back to demo mode if enabled
    if (fallbackToDemo) {
      this.demoMode = true;
      
      if (!silent && DEMO_CONFIG.SHOW_DEMO_LOGS) {
        silentConsole.log('📱 Server unavailable - using demo mode');
      }

      return {
        success: false,
        error: 'Server timeout - demo mode active',
        isDemoMode: true,
      };
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed',
      isDemoMode: false,
    };
  }

  /**
   * GET request with timeout
   */
  async get<T = any>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * POST request with timeout
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * PUT request with timeout
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * DELETE request with timeout
   */
  async delete<T = any>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Check if currently in demo mode
   */
  isDemoMode(): boolean {
    return this.demoMode;
  }

  /**
   * Force demo mode on/off
   */
  setDemoMode(enabled: boolean): void {
    this.demoMode = enabled;
  }

  /**
   * Health check with very short timeout
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.get('/health', {
        timeout: 2000,
        retries: 0,
        fallbackToDemo: false,
        silent: true,
      });
      return result.success;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Helper function to handle API responses with demo fallback
export function handleApiResponse<T>(
  response: ApiResponse<T>,
  demoData: T,
  silent: boolean = false
): T {
  if (response.success && response.data) {
    return response.data;
  }

  if (response.isDemoMode) {
    if (!silent && DEMO_CONFIG.SHOW_DEMO_LOGS) {
      silentConsole.log('📱 Using demo data due to server unavailability');
    }
    return demoData;
  }

  if (!silent && response.error && !shouldSuppressError(response.error)) {
    silentConsole.warn('⚠️ API error, using demo data:', response.error);
  }
  return demoData;
}

// Quick API call wrapper with automatic demo fallback
export async function quickApi<T>(
  endpoint: string,
  options: RequestInit & ApiOptions = {},
  demoData: T
): Promise<T> {
  const response = await apiClient.request<T>(endpoint, {
    timeout: 3000,
    retries: 1,
    fallbackToDemo: true,
    silent: false,
    ...options,
  });

  return handleApiResponse(response, demoData, options.silent);
}

// ==================== DASHBOARD API HELPERS ====================

/**
 * Fetch vendor dashboard data
 */
export async function fetchVendorDashboard(orgId: string) {
  return apiClient.get(`/dashboard/vendor/${orgId}`, {
    timeout: 5000,
    retries: 1,
    fallbackToDemo: true
  });
}

/**
 * Fetch vendor dashboard stats (lightweight)
 */
export async function fetchVendorStats(orgId: string) {
  return apiClient.get(`/dashboard/vendor/${orgId}/stats`, {
    timeout: 3000,
    retries: 1,
    fallbackToDemo: true
  });
}

/**
 * Fetch vendor chart data
 */
export async function fetchVendorChartData(orgId: string, days: number = 7) {
  return apiClient.get(`/dashboard/vendor/${orgId}/chart-data?days=${days}`, {
    timeout: 5000,
    retries: 1,
    fallbackToDemo: true
  });
}

// ==================== PROPERTY DASHBOARD API (New Naming) ====================

/**
 * Fetch property dashboard data
 * (Alias for fetchVendorDashboard with better naming for new Property system)
 */
export async function fetchPropertyDashboard(propertyId: string) {
  return fetchVendorDashboard(propertyId); // Same endpoint, better naming
}

/**
 * Fetch property dashboard stats (lightweight)
 * (Alias for fetchVendorStats with better naming for new Property system)
 */
export async function fetchPropertyStats(propertyId: string) {
  return fetchVendorStats(propertyId);
}

/**
 * Fetch property chart data
 * (Alias for fetchVendorChartData with better naming for new Property system)
 */
export async function fetchPropertyChartData(propertyId: string, days: number = 7) {
  return fetchVendorChartData(propertyId, days);
}

/**
 * Fetch admin dashboard data
 */
export async function fetchAdminDashboard() {
  return apiClient.get(`/admin/dashboard`, {
    timeout: 10000, // Increase to 10 seconds for admin dashboard
    retries: 2,     // Try 2 times
    fallbackToDemo: true
  });
}

/**
 * Fetch admin dashboard stats (lightweight)
 */
export async function fetchAdminStats() {
  return apiClient.get(`/admin/dashboard/stats`, {
    timeout: 3000,
    retries: 1,
    fallbackToDemo: true
  });
}

/**
 * Fetch admin chart data
 */
export async function fetchAdminChartData(days: number = 30) {
  return apiClient.get(`/admin/dashboard/chart-data?days=${days}`, {
    timeout: 5000,
    retries: 1,
    fallbackToDemo: true
  });
}

/**
 * Fetch feature flags
 */
export async function fetchFeatureFlags() {
  return apiClient.get(`/admin/dashboard/feature-flags`, {
    timeout: 3000,
    retries: 1,
    fallbackToDemo: true
  });
}

/**
 * Log admin activity
 */
export async function logAdminActivity(activity: {
  actorId: string;
  role: string;
  orgId?: string;
  action: string;
  payload: any;
  severity?: 'info' | 'warning' | 'error' | 'success';
}) {
  return apiClient.post(`/admin/dashboard/log-activity`, activity, {
    timeout: 3000,
    retries: 1,
    fallbackToDemo: false,
    silent: true
  });
}
