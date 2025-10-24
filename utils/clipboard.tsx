/**
 * Safe clipboard utility with fallback methods
 * Handles Clipboard API permissions errors gracefully
 */

/**
 * Safely copy text to clipboard with multiple fallback methods
 * @param text - Text to copy
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Method 1: Try modern Clipboard API (wrapped in try-catch to handle permissions errors)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Silent fail - will try fallback
      // Common errors: NotAllowedError, SecurityError, permissions policy
    }
  }

  // Method 2: Fallback using textarea + execCommand (works in all browsers, even with strict permissions)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // Make textarea invisible and positioned off-screen
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    
    document.body.appendChild(textarea);
    
    // iOS Safari requires focus + selection
    textarea.focus();
    textarea.select();
    
    // Modern browsers
    if (textarea.setSelectionRange) {
      textarea.setSelectionRange(0, text.length);
    }
    
    // Copy using deprecated execCommand (still works as reliable fallback)
    const successful = document.execCommand('copy');
    
    // Clean up
    document.body.removeChild(textarea);
    
    return successful;
  } catch (error) {
    // Absolute last resort failed
    console.error('All clipboard methods failed:', error);
    return false;
  }
}

/**
 * Copy text to clipboard and show a user-friendly message
 * @param text - Text to copy
 * @param successMessage - Optional custom success message
 * @param errorMessage - Optional custom error message
 * @returns Promise<boolean> - true if successful
 */
export async function copyToClipboardWithToast(
  text: string,
  successMessage: string = 'Copied to clipboard!',
  errorMessage: string = 'Failed to copy. Please copy manually.'
): Promise<boolean> {
  const success = await copyToClipboard(text);
  
  // We'll return the result and let the caller handle toast
  // This keeps the utility pure
  return success;
}

/**
 * Create a safe clipboard copy helper with integrated toast (for backward compatibility)
 * @deprecated Use copyToClipboard directly with your own toast handling
 */
export function createSafeCopyFunction() {
  return async (text: string): Promise<void> => {
    await copyToClipboard(text);
  };
}
