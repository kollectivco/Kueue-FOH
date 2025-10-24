/**
 * Data Normalization Utilities
 * 
 * Provides data formatting and normalization functions
 * Part of Phase 3: Data Integrity Fixes
 */

// ═══════════════════════════════════════════════════════════════════
// EMAIL NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize email address
 * - Lowercase
 * - Trim whitespace
 * - Remove dots in Gmail addresses (user.name@gmail.com === username@gmail.com)
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  
  // Gmail-specific normalization
  if (trimmed.endsWith('@gmail.com')) {
    const [localPart, domain] = trimmed.split('@');
    // Remove dots and everything after + (plus addressing)
    const normalized = localPart.replace(/\./g, '').split('+')[0];
    return `${normalized}@${domain}`;
  }
  
  return trimmed;
}

// ═══════════════════════════════════════════════════════════════════
// PHONE NUMBER NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize phone number to E.164 format
 */
export function normalizePhone(phone: string, defaultCountryCode: string = '+20'): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it (local format)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  // If doesn't start with country code, add default
  if (!digits.startsWith('20') && !digits.startsWith('+20')) {
    digits = `20${digits}`;
  }
  
  // Ensure it starts with +
  if (!digits.startsWith('+')) {
    digits = `+${digits}`;
  }
  
  return digits;
}

/**
 * Format phone for display (Egyptian format)
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  
  // +20 123 456 7890
  if (normalized.startsWith('+20')) {
    const digits = normalized.slice(3); // Remove +20
    return `+20 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  
  return phone;
}

// ═══════════════════════════════════════════════════════════════════
// CURRENCY NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize currency amount
 * - Convert to number
 * - Round to 2 decimals
 * - Remove currency symbols
 */
export function normalizeCurrency(amount: string | number): number {
  let value: number;
  
  if (typeof amount === 'string') {
    // Remove currency symbols and commas
    const cleaned = amount.replace(/[^0-9.-]/g, '');
    value = parseFloat(cleaned);
  } else {
    value = amount;
  }
  
  // Round to 2 decimals
  return Math.round(value * 100) / 100;
}

/**
 * Format currency for display (Egyptian Pound)
 */
export function formatCurrencyDisplay(amount: number | string): string {
  const normalized = normalizeCurrency(amount);
  
  // Format with thousand separators
  const formatted = new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(normalized);
  
  return formatted;
}

/**
 * Format currency for display (simple)
 */
export function formatCurrencySimple(amount: number | string): string {
  const normalized = normalizeCurrency(amount);
  return `${normalized.toFixed(2)} EGP`;
}

// ═══════════════════════════════════════════════════════════════════
// DATE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize date to ISO 8601 string
 */
export function normalizeDate(date: string | Date | number): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  
  if (typeof date === 'number') {
    return new Date(date).toISOString();
  }
  
  // Try to parse string
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  
  return parsed.toISOString();
}

/**
 * Format date for display (Arabic locale)
 */
export function formatDateDisplay(date: string | Date | number): string {
  const normalized = new Date(date);
  
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(normalized);
}

/**
 * Format date for display (short format)
 */
export function formatDateShort(date: string | Date | number): string {
  const normalized = new Date(date);
  
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(normalized);
}

/**
 * Format time for display
 */
export function formatTimeDisplay(time: string): string {
  // Ensure HH:MM format
  const match = time.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${time}`);
  }
  
  const [, hours, minutes] = match;
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  
  return `${hour12}:${minutes} ${period}`;
}

// ═══════════════════════════════════════════════════════════════════
// NAME NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize person name
 * - Trim whitespace
 * - Capitalize each word
 * - Remove extra spaces
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Split full name into first and last
 */
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

// ═══════════════════════════════════════════════════════════════════
// TEXT NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize text (general purpose)
 * - Trim whitespace
 * - Remove extra spaces
 * - Optional: lowercase
 */
export function normalizeText(text: string, options?: {
  lowercase?: boolean;
  removeSpecialChars?: boolean;
}): string {
  let normalized = text.trim().replace(/\s+/g, ' ');
  
  if (options?.lowercase) {
    normalized = normalized.toLowerCase();
  }
  
  if (options?.removeSpecialChars) {
    normalized = normalized.replace(/[^a-zA-Z0-9\s]/g, '');
  }
  
  return normalized;
}

/**
 * Create URL-safe slug from text
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens
    .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
}

// ═══════════════════════════════════════════════════════════════════
// BATCH NORMALIZATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize an object based on field types
 */
export interface NormalizationRules {
  email?: string[];
  phone?: string[];
  currency?: string[];
  date?: string[];
  name?: string[];
}

export function normalizeObject<T extends Record<string, any>>(
  obj: T,
  rules: NormalizationRules
): T {
  const normalized = { ...obj };
  
  // Normalize emails
  if (rules.email) {
    for (const field of rules.email) {
      if (typeof normalized[field] === 'string') {
        normalized[field] = normalizeEmail(normalized[field]);
      }
    }
  }
  
  // Normalize phones
  if (rules.phone) {
    for (const field of rules.phone) {
      if (typeof normalized[field] === 'string') {
        normalized[field] = normalizePhone(normalized[field]);
      }
    }
  }
  
  // Normalize currency
  if (rules.currency) {
    for (const field of rules.currency) {
      if (typeof normalized[field] === 'string' || typeof normalized[field] === 'number') {
        normalized[field] = normalizeCurrency(normalized[field]);
      }
    }
  }
  
  // Normalize dates
  if (rules.date) {
    for (const field of rules.date) {
      if (normalized[field]) {
        normalized[field] = normalizeDate(normalized[field]);
      }
    }
  }
  
  // Normalize names
  if (rules.name) {
    for (const field of rules.name) {
      if (typeof normalized[field] === 'string') {
        normalized[field] = normalizeName(normalized[field]);
      }
    }
  }
  
  return normalized;
}

// ═══════════════════════════════════════════════════════════════════
// COMPARISON HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Compare emails (normalized)
 */
export function emailsMatch(email1: string, email2: string): boolean {
  return normalizeEmail(email1) === normalizeEmail(email2);
}

/**
 * Compare phones (normalized)
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

/**
 * Compare names (normalized)
 */
export function namesMatch(name1: string, name2: string): boolean {
  return normalizeName(name1).toLowerCase() === normalizeName(name2).toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  // Email
  normalizeEmail,
  
  // Phone
  normalizePhone,
  formatPhoneDisplay,
  
  // Currency
  normalizeCurrency,
  formatCurrencyDisplay,
  formatCurrencySimple,
  
  // Date
  normalizeDate,
  formatDateDisplay,
  formatDateShort,
  formatTimeDisplay,
  
  // Name
  normalizeName,
  splitFullName,
  
  // Text
  normalizeText,
  createSlug,
  
  // Batch
  normalizeObject,
  
  // Comparison
  emailsMatch,
  phonesMatch,
  namesMatch
};
