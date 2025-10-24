/**
 * Currency Utilities for Kueue RSVP
 * All amounts are in Egyptian Pounds (EGP)
 */

export const DEFAULT_CURRENCY = 'EGP';
export const CURRENCY_SYMBOL = 'EGP';
export const LOCALE = 'en-US'; // Use en-US for Western Arabic numerals

/**
 * Format amount as Egyptian Pounds with proper spacing
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string with EGP on the right side with space
 * 
 * Examples:
 * - formatCurrency(1234.56) => "1,234.56 EGP"
 * - formatCurrency(1000, { showSymbol: false }) => "1,000.00"
 * - formatCurrency(500, { decimals: 0 }) => "500 EGP"
 */
export function formatCurrency(
  amount: number,
  options: {
    currency?: string;
    showSymbol?: boolean;
    decimals?: number;
    locale?: string;
  } = {}
): string {
  const {
    currency = DEFAULT_CURRENCY,
    showSymbol = true,
    decimals = 2,
    locale = LOCALE
  } = options;

  // Format the number with proper locale
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount);

  // Add currency symbol with space on the right
  if (showSymbol) {
    return `${formatted} ${currency}`;
  }

  return formatted;
}

/**
 * Parse currency string to number
 * @param value - Currency string like "1,234.56 EGP" or "1234.56"
 * @returns Numeric value
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and spaces
  const cleanValue = value
    .replace(/EGP|USD|EUR|GBP|AED|SAR/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format currency for display in forms (without symbol)
 */
export function formatCurrencyInput(amount: number): string {
  return formatCurrency(amount, { showSymbol: false });
}

/**
 * Format currency compactly (K for thousands, M for millions)
 * @param amount - The amount to format
 * @returns Compact currency string
 * 
 * Examples:
 * - formatCurrencyCompact(1500) => "1.5K EGP"
 * - formatCurrencyCompact(1500000) => "1.5M EGP"
 */
export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${DEFAULT_CURRENCY}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K ${DEFAULT_CURRENCY}`;
  }
  return formatCurrency(amount);
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const symbols: Record<string, string> = {
    'EGP': 'EGP',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'AED': 'AED',
    'SAR': 'SAR'
  };
  return symbols[currency] || currency;
}

/**
 * Supported currencies in the system
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'EGP' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR' }
] as const;
