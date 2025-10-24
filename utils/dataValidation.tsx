/**
 * Data Validation & Schema Definitions
 * 
 * Provides Zod schemas and validation functions for all data types
 * Part of Phase 3: Data Integrity Fixes
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// BASIC SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/**
 * UUID Schema - accepts valid UUID v4 or demo-prefixed UUID
 */
export const UUIDSchema = z.string()
  .refine(
    (val) => {
      // Allow demo_ prefix
      if (val.startsWith('demo_')) {
        const uuid = val.slice(5); // Remove 'demo_' prefix
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
      }
      // Standard UUID v4
      return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    },
    'Invalid UUID format'
  );

/**
 * Email Schema - validates and normalizes email
 */
export const EmailSchema = z.string()
  .email('Invalid email address')
  .toLowerCase()
  .trim()
  .max(255, 'Email must be less than 255 characters');

/**
 * Phone Schema - validates E.164 format and normalizes
 */
export const PhoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (use E.164: +1234567890)')
  .transform((phone) => {
    // Ensure it starts with +
    if (!phone.startsWith('+')) {
      return `+${phone}`;
    }
    return phone;
  });

/**
 * Egyptian Phone Schema - specific for Egypt
 */
export const EgyptianPhoneSchema = z.string()
  .regex(/^(\+20|0)?1[0125]\d{8}$/, 'Invalid Egyptian phone number')
  .transform((phone) => {
    // Remove leading 0 if present
    let normalized = phone.replace(/^0/, '');
    // Add +20 if not present
    if (!normalized.startsWith('+20')) {
      normalized = `+20${normalized}`;
    }
    return normalized;
  });

/**
 * URL Schema
 */
export const URLSchema = z.string()
  .url('Invalid URL format')
  .max(2048, 'URL too long');

/**
 * Currency Amount Schema (EGP)
 */
export const CurrencySchema = z.number()
  .positive('Amount must be positive')
  .finite('Amount must be finite')
  .transform((val) => Math.round(val * 100) / 100); // Round to 2 decimals

/**
 * Date Schema - ISO 8601 format
 */
export const DateSchema = z.string()
  .datetime('Invalid date format (use ISO 8601)')
  .or(z.date().transform(d => d.toISOString()));

/**
 * Color Hex Schema
 */
export const ColorSchema = z.string()
  .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format (use #RRGGBB)');

// ═══════════════════════════════════════════════════════════════════
// ENTITY SCHEMAS
// ═══════════════════════════════════════════════════════════════════

/**
 * Demo Metadata Schema
 */
export const DemoMetadataSchema = z.object({
  isDemo: z.literal(true),
  createdAt: DateSchema,
  expiresAt: DateSchema,
  demoType: z.enum(['sandbox', 'tutorial', 'test']).default('sandbox')
}).strict();

/**
 * User Role Schema
 */
export const UserRoleSchema = z.enum([
  'super_admin',
  'developer',
  'support_admin',
  'billing_admin',
  'vendor',
  'staff',
  'customer'
]);

/**
 * User Profile Schema
 */
export const UserProfileSchema = z.object({
  id: UUIDSchema,
  email: EmailSchema,
  name: z.string().min(1, 'Name is required').max(255).trim(),
  role: UserRoleSchema,
  orgId: UUIDSchema.optional(),
  phone: PhoneSchema.optional(),
  avatar: URLSchema.optional(),
  createdAt: DateSchema,
  updatedAt: DateSchema.optional(),
  _demo: DemoMetadataSchema.optional()
}).strict();

/**
 * Organization Schema
 */
export const OrganizationSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1, 'Organization name is required').max(255).trim(),
  email: EmailSchema,
  phone: PhoneSchema.optional(),
  address: z.string().max(500).optional(),
  logo: URLSchema.optional(),
  planId: UUIDSchema.optional(),
  branding: z.object({
    primaryColor: ColorSchema.default('#ff3131'),
    logo: URLSchema.optional()
  }).optional(),
  settings: z.record(z.any()).optional(),
  createdAt: DateSchema,
  updatedAt: DateSchema.optional(),
  _demo: DemoMetadataSchema.optional()
}).strict();

/**
 * Subscription Plan Schema
 */
export const SubscriptionPlanSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  priceMonthly: CurrencySchema,
  priceYearly: CurrencySchema,
  currency: z.literal('EGP'),
  features: z.record(z.boolean()),
  maxUsers: z.number().int().positive().optional(),
  maxReservations: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  createdAt: DateSchema,
  _demo: DemoMetadataSchema.optional()
}).strict();

/**
 * Reservation Status Schema
 */
export const ReservationStatusSchema = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'waitlist'
]);

/**
 * Reservation Schema
 */
export const ReservationSchema = z.object({
  id: UUIDSchema,
  orgId: UUIDSchema,
  guestId: UUIDSchema.optional(),
  guestName: z.string().min(1).max(255),
  guestEmail: EmailSchema.optional(),
  guestPhone: PhoneSchema.optional(),
  partySize: z.number().int().positive().max(100, 'Party size too large'),
  date: DateSchema,
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (use HH:MM)'),
  status: ReservationStatusSchema,
  tableId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  createdAt: DateSchema,
  updatedAt: DateSchema.optional(),
  _demo: DemoMetadataSchema.optional()
}).strict();

/**
 * Guest Schema
 */
export const GuestSchema = z.object({
  id: UUIDSchema,
  orgId: UUIDSchema,
  name: z.string().min(1).max(255).trim(),
  email: EmailSchema.optional(),
  phone: PhoneSchema.optional(),
  preferences: z.record(z.any()).optional(),
  notes: z.string().max(1000).optional(),
  visitCount: z.number().int().nonnegative().default(0),
  lastVisit: DateSchema.optional(),
  createdAt: DateSchema,
  _demo: DemoMetadataSchema.optional()
}).strict();

/**
 * Menu Item Schema
 */
export const MenuItemSchema = z.object({
  id: UUIDSchema,
  orgId: UUIDSchema,
  menuId: UUIDSchema,
  name: z.string().min(1).max(255).trim(),
  nameAr: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  descriptionAr: z.string().max(1000).optional(),
  price: CurrencySchema,
  currency: z.literal('EGP'),
  category: z.string().max(100),
  image: URLSchema.optional(),
  isAvailable: z.boolean().default(true),
  createdAt: DateSchema,
  _demo: DemoMetadataSchema.optional()
}).strict();

// ═══════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate data against schema
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Validate and throw on error
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = errorMessage || 'Validation failed';
      const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`${message}: ${details}`);
    }
    throw error;
  }
}

/**
 * Safe validate - returns null on error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  try {
    EmailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate phone number
 */
export function isValidPhone(phone: string): boolean {
  try {
    PhoneSchema.parse(phone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID
 */
export function isValidUUID(id: string): boolean {
  try {
    UUIDSchema.parse(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Egyptian phone
 */
export function isValidEgyptianPhone(phone: string): boolean {
  try {
    EgyptianPhoneSchema.parse(phone);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SANITIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(input: string): string {
  // Remove HTML tags
  const withoutTags = input.replace(/<[^>]*>/g, '');
  
  // Escape special characters
  const div = document.createElement('div');
  div.textContent = withoutTags;
  
  return div.innerHTML;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get validation error messages
 */
export function getValidationErrors(error: z.ZodError): string[] {
  return error.errors.map(e => {
    const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
    return `${path}${e.message}`;
  });
}

/**
 * Format validation error for display
 */
export function formatValidationError(error: z.ZodError): string {
  const errors = getValidationErrors(error);
  if (errors.length === 1) {
    return errors[0];
  }
  return `Validation failed:\n${errors.map(e => `• ${e}`).join('\n')}`;
}

/**
 * Validate batch of items
 */
export function validateBatch<T>(
  schema: z.ZodSchema<T>,
  items: unknown[]
): {
  valid: T[];
  invalid: Array<{ item: unknown; error: z.ZodError }>;
} {
  const valid: T[] = [];
  const invalid: Array<{ item: unknown; error: z.ZodError }> = [];
  
  for (const item of items) {
    try {
      const validated = schema.parse(item);
      valid.push(validated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        invalid.push({ item, error });
      }
    }
  }
  
  return { valid, invalid };
}

// ═══════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════

/**
 * Type guard for User Profile
 */
export function isUserProfile(data: unknown): data is z.infer<typeof UserProfileSchema> {
  return safeValidate(UserProfileSchema, data) !== null;
}

/**
 * Type guard for Organization
 */
export function isOrganization(data: unknown): data is z.infer<typeof OrganizationSchema> {
  return safeValidate(OrganizationSchema, data) !== null;
}

/**
 * Type guard for Reservation
 */
export function isReservation(data: unknown): data is z.infer<typeof ReservationSchema> {
  return safeValidate(ReservationSchema, data) !== null;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type Guest = z.infer<typeof GuestSchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;
export type DemoMetadata = z.infer<typeof DemoMetadataSchema>;

export default {
  // Schemas
  UUIDSchema,
  EmailSchema,
  PhoneSchema,
  EgyptianPhoneSchema,
  URLSchema,
  CurrencySchema,
  DateSchema,
  ColorSchema,
  UserProfileSchema,
  OrganizationSchema,
  SubscriptionPlanSchema,
  ReservationSchema,
  GuestSchema,
  MenuItemSchema,
  
  // Validation functions
  validate,
  validateOrThrow,
  safeValidate,
  isValidEmail,
  isValidPhone,
  isValidUUID,
  isValidEgyptianPhone,
  
  // Sanitization
  sanitizeString,
  sanitizeObject,
  
  // Helpers
  getValidationErrors,
  formatValidationError,
  validateBatch,
  
  // Type guards
  isUserProfile,
  isOrganization,
  isReservation
};
