/**
 * Authentication Security Utilities
 * 
 * Provides encryption, secure storage, and security helpers for auth system
 * Part of Phase 2: Auth & Permissions Fixes
 */

import { projectId } from './supabase/info';

// ═══════════════════════════════════════════════════════════════════
// ENCRYPTION UTILITIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Simple XOR-based encryption for Remember Me feature
 * Note: This is better than plain text but not cryptographically secure.
 * For production, consider using Web Crypto API or a library like crypto-js
 */

const ENCRYPTION_KEY = `kueue-rsvp-${projectId}-secret`;

function stringToBytes(str: string): number[] {
  return Array.from(str).map(char => char.charCodeAt(0));
}

function bytesToString(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

function xorEncrypt(text: string, key: string): string {
  const textBytes = stringToBytes(text);
  const keyBytes = stringToBytes(key);
  
  const encrypted = textBytes.map((byte, i) => {
    const keyByte = keyBytes[i % keyBytes.length];
    return byte ^ keyByte;
  });
  
  // Convert to base64 for storage
  return btoa(bytesToString(encrypted));
}

function xorDecrypt(encrypted: string, key: string): string {
  try {
    // Decode from base64
    const encryptedBytes = stringToBytes(atob(encrypted));
    const keyBytes = stringToBytes(key);
    
    const decrypted = encryptedBytes.map((byte, i) => {
      const keyByte = keyBytes[i % keyBytes.length];
      return byte ^ keyByte;
    });
    
    return bytesToString(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * Encrypt data for secure storage
 */
export function encryptData(data: string): string {
  try {
    return xorEncrypt(data, ENCRYPTION_KEY);
  } catch (error) {
    console.error('Encryption error:', error);
    return data; // Fallback to plain text in case of error
  }
}

/**
 * Decrypt data from secure storage
 */
export function decryptData(encrypted: string): string {
  try {
    return xorDecrypt(encrypted, ENCRYPTION_KEY);
  } catch (error) {
    console.error('Decryption error:', error);
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════════
// REMEMBER ME UTILITIES
// ═══════════════════════════════════════════════════════════════════

export interface RememberMeData {
  email: string;
  timestamp: number;
  expiresAt: number;
}

const REMEMBER_ME_KEY = 'kueue_remember';
const REMEMBER_ME_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Save email securely for Remember Me feature
 */
export function saveRememberMe(email: string): void {
  try {
    const data: RememberMeData = {
      email: email.trim(),
      timestamp: Date.now(),
      expiresAt: Date.now() + REMEMBER_ME_EXPIRY
    };
    
    const encrypted = encryptData(JSON.stringify(data));
    localStorage.setItem(REMEMBER_ME_KEY, encrypted);
    
    console.log('✅ Remember Me saved securely');
  } catch (error) {
    console.error('Failed to save Remember Me:', error);
  }
}

/**
 * Load email from Remember Me (if not expired)
 */
export function loadRememberMe(): string | null {
  try {
    const encrypted = localStorage.getItem(REMEMBER_ME_KEY);
    if (!encrypted) return null;
    
    const decrypted = decryptData(encrypted);
    if (!decrypted) return null;
    
    const data: RememberMeData = JSON.parse(decrypted);
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      console.log('Remember Me expired, clearing...');
      clearRememberMe();
      return null;
    }
    
    return data.email;
  } catch (error) {
    console.error('Failed to load Remember Me:', error);
    clearRememberMe(); // Clear corrupted data
    return null;
  }
}

/**
 * Clear Remember Me data
 */
export function clearRememberMe(): void {
  localStorage.removeItem(REMEMBER_ME_KEY);
}

// ═══════════════════════════════════════════════════════════════════
// DEVICE FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a semi-unique device fingerprint
 * Used for session security and hijacking detection
 */
export function getDeviceFingerprint(): string {
  try {
    const components: string[] = [];
    
    // Browser info
    components.push(navigator.userAgent);
    components.push(navigator.language);
    components.push(String(screen.width));
    components.push(String(screen.height));
    components.push(String(screen.colorDepth));
    components.push(String(new Date().getTimezoneOffset()));
    
    // Canvas fingerprint (more unique)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#ff3131';
      ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Kueue RSVP', 2, 2);
      components.push(canvas.toDataURL().slice(-100));
    }
    
    // Combine all components and hash
    const combined = components.join('|');
    return hashString(combined);
  } catch (error) {
    console.error('Failed to generate device fingerprint:', error);
    // Fallback to a random ID stored in localStorage
    let fallback = localStorage.getItem('kueue_device_id');
    if (!fallback) {
      fallback = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('kueue_device_id', fallback);
    }
    return fallback;
  }
}

/**
 * Simple string hashing function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ═══════════════════════════════════════════════════════════════════
// SESSION SECURITY
// ═══════════════════════════════════════════════════════════════════

export interface SessionInfo {
  userId: string;
  deviceId: string;
  userAgent: string;
  lastActivity: number;
  createdAt: number;
  ipAddress?: string;
}

const SESSION_INFO_KEY = 'kueue_session_info';

/**
 * Save session info for security tracking
 */
export async function saveSessionInfo(userId: string): Promise<void> {
  try {
    // Get IP address (optional, may fail due to CORS)
    let ipAddress: string | undefined;
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: AbortSignal.timeout(2000)
      });
      const data = await response.json();
      ipAddress = data.ip;
    } catch (error) {
      // Silent fail - IP is optional
      console.log('Could not fetch IP address (optional)');
    }
    
    const sessionInfo: SessionInfo = {
      userId,
      deviceId: getDeviceFingerprint(),
      userAgent: navigator.userAgent,
      lastActivity: Date.now(),
      createdAt: Date.now(),
      ipAddress
    };
    
    const encrypted = encryptData(JSON.stringify(sessionInfo));
    localStorage.setItem(SESSION_INFO_KEY, encrypted);
    
    console.log('✅ Session info saved');
  } catch (error) {
    console.error('Failed to save session info:', error);
  }
}

/**
 * Load session info
 */
export function loadSessionInfo(): SessionInfo | null {
  try {
    const encrypted = localStorage.getItem(SESSION_INFO_KEY);
    if (!encrypted) return null;
    
    const decrypted = decryptData(encrypted);
    if (!decrypted) return null;
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to load session info:', error);
    return null;
  }
}

/**
 * Update last activity time
 */
export function updateSessionActivity(): void {
  try {
    const sessionInfo = loadSessionInfo();
    if (!sessionInfo) return;
    
    sessionInfo.lastActivity = Date.now();
    
    const encrypted = encryptData(JSON.stringify(sessionInfo));
    localStorage.setItem(SESSION_INFO_KEY, encrypted);
  } catch (error) {
    console.error('Failed to update session activity:', error);
  }
}

/**
 * Clear session info
 */
export function clearSessionInfo(): void {
  localStorage.removeItem(SESSION_INFO_KEY);
}

/**
 * Check if session is from same device
 * Returns false if device fingerprint changed (potential hijacking)
 */
export function validateSessionDevice(): boolean {
  try {
    const sessionInfo = loadSessionInfo();
    if (!sessionInfo) return true; // No session info = no validation needed
    
    const currentDeviceId = getDeviceFingerprint();
    const isValid = sessionInfo.deviceId === currentDeviceId;
    
    if (!isValid) {
      console.warn('⚠️ Session device mismatch detected!');
      console.log('Expected:', sessionInfo.deviceId);
      console.log('Current:', currentDeviceId);
    }
    
    return isValid;
  } catch (error) {
    console.error('Failed to validate session device:', error);
    return true; // Allow on error to avoid blocking legitimate users
  }
}

// ═══════════════════════════════════════════════════════════════════
// PASSWORD SECURITY
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate password strength
 */
export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length < 8) {
    issues.push('Password must be at least 8 characters long');
    suggestions.push('Add more characters');
  } else {
    score += 25;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
  }
  
  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter');
    suggestions.push('Add an uppercase letter (A-Z)');
  } else {
    score += 15;
  }
  
  // Lowercase check
  if (!/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter');
    suggestions.push('Add a lowercase letter (a-z)');
  } else {
    score += 15;
  }
  
  // Number check
  if (!/[0-9]/.test(password)) {
    issues.push('Password must contain at least one number');
    suggestions.push('Add a number (0-9)');
  } else {
    score += 15;
  }
  
  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    issues.push('Password must contain at least one special character');
    suggestions.push('Add a special character (!@#$%^&*)');
  } else {
    score += 20;
  }
  
  // Common passwords check
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    issues.push('Password is too common');
    suggestions.push('Avoid common words and patterns');
    score = Math.max(0, score - 30);
  }
  
  return {
    isValid: issues.length === 0,
    score: Math.min(100, score),
    issues,
    suggestions
  };
}

/**
 * Get password strength description
 */
export function getPasswordStrengthLabel(score: number): {
  label: string;
  color: string;
} {
  if (score < 40) {
    return { label: 'Weak', color: '#dc2626' };
  } else if (score < 60) {
    return { label: 'Fair', color: '#f59e0b' };
  } else if (score < 80) {
    return { label: 'Good', color: '#10b981' };
  } else {
    return { label: 'Strong', color: '#059669' };
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Clear sensitive data from memory
 * Call this after login/logout to clear password fields
 */
export function clearSensitiveData(): void {
  // Clear any password inputs
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  passwordInputs.forEach(input => {
    if (input instanceof HTMLInputElement) {
      input.value = '';
    }
  });
  
  // Clear clipboard if it contains password (optional)
  try {
    if (navigator.clipboard) {
      navigator.clipboard.writeText('');
    }
  } catch (error) {
    // Silent fail - clipboard access may be denied
  }
}

/**
 * Check if running in secure context (HTTPS)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext;
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `session_${timestamp}_${random}`;
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════════════════════════

export interface AuditLogEntry {
  timestamp: number;
  userId?: string;
  action: string;
  details: Record<string, any>;
  deviceId: string;
  userAgent: string;
}

const AUDIT_LOG_KEY = 'kueue_audit_log';
const MAX_AUDIT_ENTRIES = 100; // Keep last 100 entries locally

/**
 * Add entry to local audit log
 * Note: In production, this should also be sent to server
 */
export function logAuditEvent(
  action: string,
  details: Record<string, any>,
  userId?: string
): void {
  try {
    const entry: AuditLogEntry = {
      timestamp: Date.now(),
      userId,
      action,
      details,
      deviceId: getDeviceFingerprint(),
      userAgent: navigator.userAgent
    };
    
    // Load existing logs
    const existingLogs = localStorage.getItem(AUDIT_LOG_KEY);
    let logs: AuditLogEntry[] = existingLogs ? JSON.parse(existingLogs) : [];
    
    // Add new entry
    logs.push(entry);
    
    // Keep only last MAX_AUDIT_ENTRIES
    if (logs.length > MAX_AUDIT_ENTRIES) {
      logs = logs.slice(-MAX_AUDIT_ENTRIES);
    }
    
    // Save
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
    
    console.log('📝 Audit log:', action, details);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Get audit logs
 */
export function getAuditLogs(limit?: number): AuditLogEntry[] {
  try {
    const logs = localStorage.getItem(AUDIT_LOG_KEY);
    if (!logs) return [];
    
    const parsed: AuditLogEntry[] = JSON.parse(logs);
    return limit ? parsed.slice(-limit) : parsed;
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

/**
 * Clear audit logs
 */
export function clearAuditLogs(): void {
  localStorage.removeItem(AUDIT_LOG_KEY);
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  // Encryption
  encryptData,
  decryptData,
  
  // Remember Me
  saveRememberMe,
  loadRememberMe,
  clearRememberMe,
  
  // Device & Session
  getDeviceFingerprint,
  saveSessionInfo,
  loadSessionInfo,
  updateSessionActivity,
  clearSessionInfo,
  validateSessionDevice,
  
  // Password
  validatePasswordStrength,
  getPasswordStrengthLabel,
  
  // Security
  clearSensitiveData,
  isSecureContext,
  generateSessionId,
  sanitizeInput,
  
  // Audit
  logAuditEvent,
  getAuditLogs,
  clearAuditLogs
};
