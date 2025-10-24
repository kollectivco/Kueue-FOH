/**
 * Property Code Generator Utility
 * Generates unique, human-friendly property codes and slugs
 * Format: P-CAI-AB12CD (Property-City-NanoID)
 */

import { customAlphabet } from 'nanoid';

// Base36 alphabet (numbers + uppercase letters, excluding similar looking chars)
// Excludes: I, O, 0, 1 to avoid confusion
const base36Alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Create a custom NanoID generator with base36 alphabet
const nanoid = customAlphabet(base36Alphabet, 6);

/**
 * City/Area codes mapping
 * Common Egyptian cities and areas
 */
export const CITY_CODES: Record<string, string> = {
  // Cairo
  'cairo': 'CAI',
  'zamalek': 'ZAM',
  'maadi': 'MAA',
  'heliopolis': 'HEL',
  'nasr_city': 'NSR',
  'new_cairo': 'NCR',
  'sixth_october': '6OC',
  'sheikh_zayed': 'SHZ',
  
  // Alexandria
  'alexandria': 'ALX',
  'borg_el_arab': 'BEA',
  
  // Other major cities
  'giza': 'GIZ',
  'sharm_el_sheikh': 'SHS',
  'hurghada': 'HRG',
  'luxor': 'LXR',
  'aswan': 'ASW',
  'port_said': 'PSD',
  'suez': 'SUZ',
  'mansoura': 'MNS',
  'tanta': 'TNT',
  'asyut': 'ASY',
  
  // Default/Other
  'other': 'OTH',
  'unknown': 'UNK',
};

/**
 * Property type prefixes
 */
export const PROPERTY_TYPE_PREFIXES: Record<string, string> = {
  'property': 'P',
  'restaurant': 'R',
  'hotel': 'H',
  'cafe': 'C',
  'venue': 'V',
  'club': 'CL',
};

export interface PropertyCodeConfig {
  propertyType?: string; // Default: 'property'
  cityCode?: string; // Optional city/area code
  customPrefix?: string; // Override the auto-generated prefix
}

/**
 * Generate a unique property code
 * Format: P-CAI-AB12CD or P-AB12CD (if no city code)
 */
export function generatePropertyCode(config: PropertyCodeConfig = {}): string {
  const {
    propertyType = 'property',
    cityCode,
    customPrefix,
  } = config;

  // Get the type prefix
  const typePrefix = customPrefix || PROPERTY_TYPE_PREFIXES[propertyType.toLowerCase()] || 'P';
  
  // Get the city code if provided
  const city = cityCode ? cityCode.toUpperCase() : null;
  
  // Generate the unique identifier
  const uniqueId = nanoid();
  
  // Construct the code
  if (city) {
    return `${typePrefix}-${city}-${uniqueId}`;
  } else {
    return `${typePrefix}-${uniqueId}`;
  }
}

/**
 * Generate a URL-friendly slug from property name and code
 * Format: marriott-zamalek-pcai-ab12cd
 */
export function generatePropertySlug(
  propertyName: string,
  propertyCode: string,
  includeCity: boolean = true
): string {
  // Clean and slugify the property name
  const cleanName = propertyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .substring(0, 50); // Limit length
  
  // Clean the property code for URL
  const cleanCode = propertyCode
    .toLowerCase()
    .replace(/\s+/g, '');
  
  // Combine name and code
  return `${cleanName}-${cleanCode}`;
}

/**
 * Parse a property code to extract its components
 */
export function parsePropertyCode(code: string): {
  typePrefix: string;
  cityCode?: string;
  uniqueId: string;
  isValid: boolean;
} {
  // Remove any whitespace
  const cleanCode = code.trim().toUpperCase();
  
  // Split by hyphen
  const parts = cleanCode.split('-');
  
  if (parts.length < 2 || parts.length > 3) {
    return {
      typePrefix: '',
      uniqueId: '',
      isValid: false,
    };
  }
  
  if (parts.length === 2) {
    // Format: P-AB12CD
    return {
      typePrefix: parts[0],
      uniqueId: parts[1],
      isValid: true,
    };
  } else {
    // Format: P-CAI-AB12CD
    return {
      typePrefix: parts[0],
      cityCode: parts[1],
      uniqueId: parts[2],
      isValid: true,
    };
  }
}

/**
 * Validate a property code format
 */
export function validatePropertyCode(code: string): boolean {
  const parsed = parsePropertyCode(code);
  
  if (!parsed.isValid) {
    return false;
  }
  
  // Validate type prefix (1-2 uppercase letters)
  if (!/^[A-Z]{1,2}$/.test(parsed.typePrefix)) {
    return false;
  }
  
  // Validate city code if present (2-3 uppercase letters)
  if (parsed.cityCode && !/^[A-Z]{2,3}$/.test(parsed.cityCode)) {
    return false;
  }
  
  // Validate unique ID (6-8 alphanumeric characters)
  if (!/^[A-Z0-9]{6,8}$/.test(parsed.uniqueId)) {
    return false;
  }
  
  return true;
}

/**
 * Format property code for display (adds proper spacing)
 */
export function formatPropertyCode(code: string): string {
  const parsed = parsePropertyCode(code);
  
  if (!parsed.isValid) {
    return code;
  }
  
  if (parsed.cityCode) {
    return `${parsed.typePrefix}-${parsed.cityCode}-${parsed.uniqueId}`;
  } else {
    return `${parsed.typePrefix}-${parsed.uniqueId}`;
  }
}

/**
 * Get city name from city code
 */
export function getCityNameFromCode(cityCode: string): string {
  const upperCode = cityCode.toUpperCase();
  
  for (const [cityName, code] of Object.entries(CITY_CODES)) {
    if (code === upperCode) {
      return cityName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  
  return 'Unknown';
}

/**
 * Generate a batch of unique property codes (for testing/demo)
 */
export function generatePropertyCodeBatch(
  count: number,
  config: PropertyCodeConfig = {}
): string[] {
  const codes = new Set<string>();
  
  while (codes.size < count) {
    codes.add(generatePropertyCode(config));
  }
  
  return Array.from(codes);
}

/**
 * Check if a property code is unique within a list
 */
export function isPropertyCodeUnique(
  code: string,
  existingCodes: string[]
): boolean {
  const normalizedCode = code.trim().toUpperCase();
  const normalizedExisting = existingCodes.map(c => c.trim().toUpperCase());
  
  return !normalizedExisting.includes(normalizedCode);
}

/**
 * Generate property code suggestions based on property details
 */
export function suggestPropertyCode(
  propertyName: string,
  city?: string,
  propertyType: string = 'property'
): string[] {
  const suggestions: string[] = [];
  
  // Find city code
  const cityKey = city?.toLowerCase().replace(/\s+/g, '_');
  const cityCode = cityKey && CITY_CODES[cityKey] ? CITY_CODES[cityKey] : undefined;
  
  // Generate 3 suggestions
  for (let i = 0; i < 3; i++) {
    suggestions.push(generatePropertyCode({
      propertyType,
      cityCode,
    }));
  }
  
  return suggestions;
}
