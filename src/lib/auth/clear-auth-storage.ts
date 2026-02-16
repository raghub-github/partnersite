/**
 * Utility to clear all Supabase authentication storage
 * This helps resolve PKCE code verifier issues
 */

export function clearAuthStorage() {
  if (typeof window === 'undefined') return;

  try {
    // Clear localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
        sessionStorage.removeItem(key);
      }
    });

    console.log('[clear-auth-storage] Cleared all auth storage');
  } catch (error) {
    console.error('[clear-auth-storage] Error clearing storage:', error);
  }
}

export function clearAuthCookies() {
  if (typeof document === 'undefined') return;

  try {
    // Get all cookies
    const cookies = document.cookie.split(';');
    
    cookies.forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      
      // Clear Supabase auth cookies
      if (name.startsWith('sb-') || name.includes('supabase') || name.includes('auth')) {
        // Clear for current domain
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
      }
    });

    console.log('[clear-auth-storage] Cleared auth cookies');
  } catch (error) {
    console.error('[clear-auth-storage] Error clearing cookies:', error);
  }
}

export function clearAllAuthData() {
  clearAuthStorage();
  clearAuthCookies();
}