/**
 * Kueue RSVP Utilities Index
 * Central export point for all utility functions
 */

// Currency utilities
export {
  formatCurrency,
  parseCurrency,
  formatCurrencyInput,
  formatCurrencyCompact,
  getCurrencySymbol,
  DEFAULT_CURRENCY,
  CURRENCY_SYMBOL,
  LOCALE,
  SUPPORTED_CURRENCIES
} from './currency';

// Supabase utilities
export { supabase } from './supabase/client';
export { projectId, publicAnonKey } from './supabase/info';

// API client utilities
export {
  apiClient,
  handleApiResponse,
  quickApi,
  fetchVendorDashboard,
  fetchVendorStats,
  fetchVendorChartData,
  fetchAdminDashboard,
  fetchAdminStats,
  fetchAdminChartData,
  fetchFeatureFlags,
  logAdminActivity
} from './apiClient';

// Demo config
export { DEMO_CONFIG, shouldSuppressError, silentConsole } from './demoConfig';

// Feature flags
export {
  isFeatureEnabled,
  checkFeatures,
  getEnabledFeatures,
  hasFeatureAccess,
  getFeatureName,
  getFeatureAccessMessage,
  useFeatureAccess,
  FEATURES,
  FEATURE_NAMES,
  DEFAULT_PLAN_FEATURES
} from './featureFlags';

// Clipboard utilities
export { copyToClipboard, copyToClipboardWithToast } from './clipboard';
