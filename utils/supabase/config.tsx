// إعدادات Supabase مع دعم Custom Domain
import { projectId, publicAnonKey } from './info';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  projectId: string;
}

// تحديد الـ URL بناءً على البيئة
const getSupabaseUrl = (): string => {
  // إذا كان لديك custom domain
  const customDomain = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || 
                      process.env.REACT_APP_CUSTOM_DOMAIN;
  
  if (customDomain) {
    return `https://${customDomain}`;
  }
  
  // استخدام الـ URL الافتراضي
  return `https://${projectId}.supabase.co`;
};

// تحديد Base URL للـ API calls مع دعم Custom Domain
const getApiBaseUrl = (): string => {
  // التحقق من Custom Domain
  const isCustomDomain = window.location.hostname !== 'localhost' && 
                         !window.location.hostname.includes('figma');
  
  if (isCustomDomain) {
    // استخدام Custom Domain مع مسار API
    return `https://${window.location.hostname}/api`;
  }
  
  // استخدام Supabase URL الافتراضي
  return `https://${projectId}.supabase.co/functions/v1/make-server-a344fe62`;
};

export const supabaseConfig: SupabaseConfig = {
  url: getSupabaseUrl(),
  anonKey: publicAnonKey,
  projectId: projectId
};

export const apiConfig = {
  baseUrl: getApiBaseUrl(),
  headers: {
    'Authorization': `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Helper function لبناء API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${apiConfig.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// معلومات الدومين الحالي
export const domainInfo = {
  isCustomDomain: !getSupabaseUrl().includes('.supabase.co'),
  currentUrl: getSupabaseUrl(),
  apiUrl: getApiBaseUrl()
};

// لوجينغ معلومات الاتصال
console.log('🔧 Supabase Configuration:', {
  url: supabaseConfig.url,
  apiBaseUrl: apiConfig.baseUrl,
  isCustomDomain: domainInfo.isCustomDomain,
  projectId: projectId
});