/**
 * Feature Flags Utility
 * Centralized system for checking feature access based on subscription plans
 */

import { PlanFeatures } from '../components/SubscriptionModel';

export interface Organization {
  id: string;
  name: string;
  planId?: string;
  planFeatures?: PlanFeatures;
}

/**
 * Feature names mapping
 */
export const FEATURES = {
  RESERVATIONS: 'enable_reservations',
  EVENTS: 'enable_events',
  DIGITAL_MENU: 'enable_digital_menu',
  FLOOR_PLAN: 'enable_floor_plan',
  WAITLIST: 'enable_waitlist',
  GUESTS: 'enable_guests',
  COMMUNICATIONS: 'enable_communications',
} as const;

/**
 * Feature display names (Arabic & English)
 */
export const FEATURE_NAMES = {
  enable_reservations: {
    en: 'Reservations',
    ar: 'الحجوزات'
  },
  enable_events: {
    en: 'Events',
    ar: 'الفعاليات'
  },
  enable_digital_menu: {
    en: 'Digital Menu',
    ar: 'القائمة الرقمية'
  },
  enable_floor_plan: {
    en: 'Floor Plan',
    ar: 'مخطط الطوابق'
  },
  enable_waitlist: {
    en: 'Waitlist',
    ar: 'قائمة الانتظار'
  },
  enable_guests: {
    en: 'Guests',
    ar: 'الضيوف'
  },
  enable_communications: {
    en: 'Communications',
    ar: 'الاتصالات'
  },
} as const;

/**
 * Check if a feature is enabled for the organization
 * @param planFeatures - Plan features object
 * @param featureName - Feature name to check
 * @returns boolean - true if feature is enabled
 */
export function isFeatureEnabled(
  planFeatures: PlanFeatures | undefined,
  featureName: keyof typeof FEATURES
): boolean {
  if (!planFeatures) {
    console.warn('⚠️ No plan features provided, defaulting to false');
    return false;
  }

  const featureKey = FEATURES[featureName];
  const enabled = planFeatures[featureKey as keyof PlanFeatures] as boolean;
  
  return Boolean(enabled);
}

/**
 * Check multiple features at once
 * @param planFeatures - Plan features object
 * @param featureNames - Array of feature names
 * @returns Record<string, boolean> - Object with feature enabled status
 */
export function checkFeatures(
  planFeatures: PlanFeatures | undefined,
  featureNames: Array<keyof typeof FEATURES>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  
  featureNames.forEach(featureName => {
    result[featureName] = isFeatureEnabled(planFeatures, featureName);
  });
  
  return result;
}

/**
 * Get all enabled features
 * @param planFeatures - Plan features object
 * @returns Array of enabled feature names
 */
export function getEnabledFeatures(
  planFeatures: PlanFeatures | undefined
): string[] {
  if (!planFeatures) return [];
  
  return Object.keys(FEATURES).filter(key =>
    isFeatureEnabled(planFeatures, key as keyof typeof FEATURES)
  );
}

/**
 * Check if organization has access to a feature
 * @param organization - Organization object
 * @param featureName - Feature name to check
 * @returns boolean
 */
export function hasFeatureAccess(
  organization: Organization | null | undefined,
  featureName: keyof typeof FEATURES
): boolean {
  if (!organization) {
    console.warn('⚠️ No organization provided');
    return false;
  }

  // If no plan features, deny access
  if (!organization.planFeatures) {
    console.warn(`⚠️ Organization ${organization.name} has no plan features`);
    return false;
  }

  return isFeatureEnabled(organization.planFeatures, featureName);
}

/**
 * Get feature display name
 * @param featureKey - Feature key
 * @param language - 'ar' or 'en'
 * @returns Display name
 */
export function getFeatureName(
  featureKey: string,
  language: 'ar' | 'en' = 'en'
): string {
  const key = `enable_${featureKey.toLowerCase()}` as keyof typeof FEATURE_NAMES;
  return FEATURE_NAMES[key]?.[language] || featureKey;
}

/**
 * Feature access message
 */
export function getFeatureAccessMessage(
  featureName: keyof typeof FEATURES,
  hasAccess: boolean
): string {
  if (hasAccess) {
    return `✅ ${featureName} is enabled in your plan`;
  }
  return `⚠️ ${featureName} is not available in your current plan. Please upgrade to access this feature.`;
}

/**
 * Default plan features (fallback for free/trial users)
 */
export const DEFAULT_PLAN_FEATURES: PlanFeatures = {
  max_organizations: 1,
  max_campaigns_per_org: 1,
  max_reservations_per_month: 50,
  max_waitlist_per_month: 20,
  
  // Core modules - basic free plan
  enable_reservations: true,      // Basic reservations always enabled
  enable_events: false,
  enable_digital_menu: false,
  enable_floor_plan: false,
  enable_waitlist: true,         // Basic waitlist always enabled
  enable_guests: false,
  enable_communications: false,
  
  // Advanced features (all disabled for free)
  custom_branding: false,
  advanced_analytics: false,
  api_access: false,
  priority_support: false,
  white_label: false,
  multi_location: false,
  custom_integrations: false,
  real_time_notifications: false,
  advanced_reporting: false,
  bulk_operations: false,
};

/**
 * Get feature status for current organization
 * Note: This is NOT a React hook despite the "use" prefix
 * It's a pure function that returns feature access info
 */
export function useFeatureAccess(
  organization: Organization | null | undefined
) {
  const planFeatures = organization?.planFeatures || DEFAULT_PLAN_FEATURES;
  
  return {
    hasReservations: isFeatureEnabled(planFeatures, 'RESERVATIONS'),
    hasEvents: isFeatureEnabled(planFeatures, 'EVENTS'),
    hasDigitalMenu: isFeatureEnabled(planFeatures, 'DIGITAL_MENU'),
    hasFloorPlan: isFeatureEnabled(planFeatures, 'FLOOR_PLAN'),
    hasWaitlist: isFeatureEnabled(planFeatures, 'WAITLIST'),
    hasGuests: isFeatureEnabled(planFeatures, 'GUESTS'),
    hasCommunications: isFeatureEnabled(planFeatures, 'COMMUNICATIONS'),
    
    // Utility function
    checkFeature: (featureName: keyof typeof FEATURES) =>
      isFeatureEnabled(planFeatures, featureName),
    
    // Get all enabled features
    enabledFeatures: getEnabledFeatures(planFeatures),
  };
}

/**
 * Alternative name for useFeatureAccess (more accurate since it's not a hook)
 */
export const getFeatureAccess = useFeatureAccess;
