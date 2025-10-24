/**
 * Data Integrity Utilities
 * 
 * Provides UUID standardization, demo detection, and data integrity helpers
 * Part of Phase 3: Data Integrity Fixes
 */

// ═══════════════════════════════════════════════════════════════════
// UUID GENERATION & VALIDATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a valid UUID v4
 * Uses crypto.randomUUID() if available, fallback to manual generation
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback manual generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate UUID format (v4)
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Check if ID is a demo ID
 */
export function isDemo(id: string): boolean {
  return id.startsWith('demo_');
}

/**
 * Check if ID is a demo organization
 */
export function isDemoOrg(orgId: string): boolean {
  return orgId.startsWith('demo_');
}

/**
 * Check if ID is a demo user
 */
export function isDemoUser(userId: string): boolean {
  return userId.startsWith('demo_');
}

/**
 * Extract UUID from demo ID
 */
export function extractUUIDFromDemo(demoId: string): string | null {
  if (!isDemo(demoId)) return null;
  
  // demo_org_uuid or demo_uuid
  const parts = demoId.split('_');
  const uuidPart = parts[parts.length - 1];
  
  return isValidUUID(uuidPart) ? uuidPart : null;
}

// ═══════════════════════════════════════════════════════════════════
// DEMO ID GENERATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate demo organization ID
 */
export function generateDemoOrgId(): string {
  return `demo_org_${generateUUID()}`;
}

/**
 * Generate demo user ID
 */
export function generateDemoUserId(): string {
  return `demo_user_${generateUUID()}`;
}

/**
 * Generate demo plan ID
 */
export function generateDemoPlanId(): string {
  return `demo_plan_${generateUUID()}`;
}

/**
 * Generate demo ID with custom prefix
 */
export function generateDemoId(type: string): string {
  return `demo_${type}_${generateUUID()}`;
}

/**
 * Well-known demo IDs for consistent demo data
 */
export const DEMO_IDS = {
  // Organizations
  DEMO_ORG_PRIMARY: 'demo_org_00000000-0000-0000-0000-000000000001',
  DEMO_ORG_RESTAURANT: 'demo_org_00000000-0000-0000-0000-000000000002',
  DEMO_ORG_CAFE: 'demo_org_00000000-0000-0000-0000-000000000003',
  
  // Users
  DEMO_USER_VENDOR: 'demo_user_00000000-0000-0000-0000-000000000001',
  DEMO_USER_ADMIN: 'demo_user_00000000-0000-0000-0000-000000000002',
  DEMO_USER_STAFF: 'demo_user_00000000-0000-0000-0000-000000000003',
  
  // Plans
  DEMO_PLAN_FREE: 'demo_plan_00000000-0000-0000-0000-000000000001',
  DEMO_PLAN_STARTER: 'demo_plan_00000000-0000-0000-0000-000000000002',
  DEMO_PLAN_PRO: 'demo_plan_00000000-0000-0000-0000-000000000003',
  DEMO_PLAN_ENTERPRISE: 'demo_plan_00000000-0000-0000-0000-000000000004',
} as const;

// ═══════════════════════════════════════════════════════════════════
// ID MIGRATION & STANDARDIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert legacy ID to standard UUID
 * Maps old IDs to new UUIDs
 */
const legacyIdMap = new Map<string, string>();

export function migrateLegacyId(legacyId: string): string {
  // Already a valid UUID
  if (isValidUUID(legacyId) || isDemo(legacyId)) {
    return legacyId;
  }
  
  // Check if we've already migrated this ID
  if (legacyIdMap.has(legacyId)) {
    return legacyIdMap.get(legacyId)!;
  }
  
  // Common legacy IDs → Demo IDs
  const commonMigrations: Record<string, string> = {
    'demo-org-id': DEMO_IDS.DEMO_ORG_PRIMARY,
    'demo-user-id': DEMO_IDS.DEMO_USER_VENDOR,
    'plan-free': DEMO_IDS.DEMO_PLAN_FREE,
    'plan-starter': DEMO_IDS.DEMO_PLAN_STARTER,
    'plan-basic': DEMO_IDS.DEMO_PLAN_STARTER,
    'plan-pro': DEMO_IDS.DEMO_PLAN_PRO,
    'plan-professional': DEMO_IDS.DEMO_PLAN_PRO,
    'plan-enterprise': DEMO_IDS.DEMO_PLAN_ENTERPRISE,
  };
  
  if (commonMigrations[legacyId]) {
    return commonMigrations[legacyId];
  }
  
  // Generate new UUID for unknown legacy ID
  const newUuid = generateUUID();
  legacyIdMap.set(legacyId, newUuid);
  
  console.warn(`Migrated legacy ID "${legacyId}" to UUID "${newUuid}"`);
  
  return newUuid;
}

/**
 * Standardize ID - ensures all IDs are valid UUIDs
 */
export function standardizeId(id: string | undefined | null): string | null {
  if (!id) return null;
  
  // Already valid
  if (isValidUUID(id) || isDemo(id)) {
    return id;
  }
  
  // Try to migrate
  return migrateLegacyId(id);
}

/**
 * Batch standardize IDs in an object
 */
export function standardizeIds<T extends Record<string, any>>(
  obj: T,
  idFields: (keyof T)[]
): T {
  const standardized = { ...obj };
  
  for (const field of idFields) {
    const value = obj[field];
    if (typeof value === 'string') {
      standardized[field] = (standardizeId(value) || value) as any;
    }
  }
  
  return standardized;
}

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create demo metadata
 */
export function createDemoMetadata(expiresInDays: number = 7): {
  isDemo: true;
  createdAt: string;
  expiresAt: string;
  demoType: 'sandbox' | 'tutorial' | 'test';
} {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  
  return {
    isDemo: true,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    demoType: 'sandbox'
  };
}

/**
 * Check if demo data is expired
 */
export function isDemoExpired(metadata?: {
  isDemo?: boolean;
  expiresAt?: string;
}): boolean {
  if (!metadata?.isDemo || !metadata?.expiresAt) {
    return false;
  }
  
  const expiresAt = new Date(metadata.expiresAt);
  return expiresAt < new Date();
}

/**
 * Filter out demo data from array
 */
export function filterDemoData<T extends { id: string }>(items: T[]): T[] {
  return items.filter(item => !isDemo(item.id));
}

/**
 * Filter out production data (keep only demo)
 */
export function filterProductionData<T extends { id: string }>(items: T[]): T[] {
  return items.filter(item => isDemo(item.id));
}

/**
 * Separate demo and production data
 */
export function separateDemoData<T extends { id: string }>(
  items: T[]
): { demo: T[]; production: T[] } {
  const demo: T[] = [];
  const production: T[] = [];
  
  for (const item of items) {
    if (isDemo(item.id)) {
      demo.push(item);
    } else {
      production.push(item);
    }
  }
  
  return { demo, production };
}

// ═══════════════════════════════════════════════════════════════════
// DATA INTEGRITY CHECKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if entity has valid references
 */
export interface ReferentialIntegrityCheck {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate user references
 */
export function validateUserReferences(
  user: { id: string; orgId?: string },
  organizations: { id: string }[]
): ReferentialIntegrityCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check user ID
  if (!isValidUUID(user.id) && !isDemo(user.id)) {
    errors.push(`Invalid user ID format: ${user.id}`);
  }
  
  // Check org reference
  if (user.orgId) {
    if (!isValidUUID(user.orgId) && !isDemo(user.orgId)) {
      errors.push(`Invalid organization ID format: ${user.orgId}`);
    }
    
    const orgExists = organizations.some(org => org.id === user.orgId);
    if (!orgExists) {
      errors.push(`Organization not found: ${user.orgId}`);
    }
  } else {
    warnings.push('User has no organization assigned');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate organization references
 */
export function validateOrganizationReferences(
  org: { id: string; planId?: string },
  plans: { id: string }[]
): ReferentialIntegrityCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check org ID
  if (!isValidUUID(org.id) && !isDemo(org.id)) {
    errors.push(`Invalid organization ID format: ${org.id}`);
  }
  
  // Check plan reference
  if (org.planId) {
    if (!isValidUUID(org.planId) && !isDemo(org.planId)) {
      errors.push(`Invalid plan ID format: ${org.planId}`);
    }
    
    const planExists = plans.some(plan => plan.id === org.planId);
    if (!planExists) {
      errors.push(`Plan not found: ${org.planId}`);
    }
  } else {
    warnings.push('Organization has no plan assigned');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ═══════════════════════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Find duplicate emails
 */
export function findDuplicateEmails<T extends { email: string }>(
  items: T[]
): Map<string, T[]> {
  const emailMap = new Map<string, T[]>();
  
  for (const item of items) {
    const normalizedEmail = item.email.toLowerCase().trim();
    const existing = emailMap.get(normalizedEmail) || [];
    existing.push(item);
    emailMap.set(normalizedEmail, existing);
  }
  
  // Filter to only duplicates
  const duplicates = new Map<string, T[]>();
  for (const [email, items] of emailMap.entries()) {
    if (items.length > 1) {
      duplicates.set(email, items);
    }
  }
  
  return duplicates;
}

/**
 * Find duplicate names
 */
export function findDuplicateNames<T extends { name: string }>(
  items: T[]
): Map<string, T[]> {
  const nameMap = new Map<string, T[]>();
  
  for (const item of items) {
    const normalizedName = item.name.toLowerCase().trim();
    const existing = nameMap.get(normalizedName) || [];
    existing.push(item);
    nameMap.set(normalizedName, existing);
  }
  
  // Filter to only duplicates
  const duplicates = new Map<string, T[]>();
  for (const [name, items] of nameMap.entries()) {
    if (items.length > 1) {
      duplicates.set(name, items);
    }
  }
  
  return duplicates;
}

/**
 * Check if two entities are likely duplicates
 */
export function areLikelyDuplicates(
  a: { name: string; email?: string },
  b: { name: string; email?: string }
): boolean {
  // Same email (definite duplicate)
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
    return true;
  }
  
  // Very similar names (Levenshtein distance < 3)
  const nameA = a.name.toLowerCase().trim();
  const nameB = b.name.toLowerCase().trim();
  
  if (nameA === nameB) {
    return true;
  }
  
  // Simple similarity check
  const distance = levenshteinDistance(nameA, nameB);
  return distance <= 2;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ══════��════════════════════════════════════════════════════════════

export default {
  // UUID functions
  generateUUID,
  isValidUUID,
  
  // Demo detection
  isDemo,
  isDemoOrg,
  isDemoUser,
  extractUUIDFromDemo,
  
  // Demo ID generation
  generateDemoOrgId,
  generateDemoUserId,
  generateDemoPlanId,
  generateDemoId,
  DEMO_IDS,
  
  // Migration
  migrateLegacyId,
  standardizeId,
  standardizeIds,
  
  // Demo data helpers
  createDemoMetadata,
  isDemoExpired,
  filterDemoData,
  filterProductionData,
  separateDemoData,
  
  // Integrity checks
  validateUserReferences,
  validateOrganizationReferences,
  
  // Duplicate detection
  findDuplicateEmails,
  findDuplicateNames,
  areLikelyDuplicates
};
