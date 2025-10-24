// Digital Menu & QR Order-at-Table Types

export interface MenuItem {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  photo?: string;
  price: number;
  category: string;
  categoryId: string;
  
  // Nutritional & Allergen Info
  calories?: number;
  allergens?: string[]; // ['gluten', 'dairy', 'nuts', 'shellfish', 'eggs', 'soy']
  dietary?: string[]; // ['vegetarian', 'vegan', 'halal', 'gluten-free', 'keto']
  spicyLevel?: number; // 0-5
  
  // Modifiers & Customization
  modifiers?: MenuModifier[];
  hasModifiers: boolean;
  
  // Kitchen & Service
  kitchenRoute?: string; // 'grill', 'salad', 'dessert', 'bar'
  prepTime?: number; // minutes
  
  // Availability
  available: boolean;
  stockCount?: number; // for inventory tracking
  
  // Metadata
  popular?: boolean;
  recommended?: boolean;
  isNew?: boolean;
  displayOrder: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface MenuModifier {
  id: string;
  name: string;
  nameAr?: string;
  type: 'single' | 'multiple'; // radio vs checkboxes
  required: boolean;
  minSelections?: number;
  maxSelections?: number;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  nameAr?: string;
  priceAdjustment: number; // +/- from base price
  available: boolean;
  default?: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  icon?: string;
  displayOrder: number;
  items: string[]; // MenuItem IDs
  active: boolean;
  
  // Scheduling
  availableFrom?: string; // HH:mm
  availableUntil?: string; // HH:mm
  
  createdAt: string;
  updatedAt: string;
}

export interface Menu {
  id: string;
  orgId: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  
  // Categories
  categories: string[]; // CategoryID[]
  
  // Settings
  active: boolean;
  showPrices: boolean;
  currency: string; // 'EGP', 'USD', 'SAR'
  currencySymbol: string;
  
  // Branding
  logo?: string;
  coverImage?: string;
  primaryColor?: string;
  accentColor?: string;
  
  // Schedule
  scheduleType?: 'always' | 'shift' | 'custom';
  shifts?: MenuShift[]; // breakfast, lunch, dinner
  validFrom?: string; // date
  validUntil?: string; // date
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MenuShift {
  id: string;
  name: string; // 'Breakfast', 'Lunch', 'Dinner'
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
  days: number[]; // [0-6] Sunday=0
}

export interface MenuAssignment {
  id: string;
  orgId: string;
  menuId: string;
  
  // Assignment Scope
  scope: 'all' | 'branch' | 'zone' | 'table';
  branchId?: string;
  zoneId?: string;
  tableId?: string;
  tableIds?: string[];
  
  // Shift & Schedule
  shift?: string; // 'breakfast', 'lunch', 'dinner', 'all'
  validFrom?: string;
  validUntil?: string;
  
  // Settings Override
  showPrices?: boolean;
  
  active: boolean;
  priority: number; // for conflict resolution
  
  createdAt: string;
  updatedAt: string;
}

export interface QRMenuLink {
  id: string;
  signature: string; // SHA256 HMAC signature
  orgId: string;
  menuId: string;
  
  // Table Context
  tableId?: string;
  tableNumber?: string;
  zoneName?: string;
  branchId?: string;
  
  // Settings
  hidePrices?: boolean;
  prefilledData?: {
    tableName?: string;
    zone?: string;
  };
  
  // Security
  expiresAt?: string;
  maxUses?: number;
  usedCount: number;
  
  // Metadata
  createdAt: string;
  lastUsed?: string;
}

export interface MenuView {
  id: string;
  menuId: string;
  qrLinkId?: string;
  
  // Context
  tableId?: string;
  sessionId: string;
  
  // Analytics
  viewedAt: string;
  viewDuration?: number; // seconds
  itemsViewed: string[]; // MenuItem IDs
  categoriesViewed: string[];
  
  // Conversion
  addedToCart: boolean;
  orderPlaced: boolean;
  orderId?: string;
}

export interface KitchenRoute {
  id: string;
  orgId: string;
  name: string;
  nameAr?: string;
  description?: string;
  
  // Categories
  categories: string[]; // Which menu categories go to this station
  
  // Printers
  printers?: KitchenPrinter[];
  
  // Display Settings
  displayColor?: string;
  icon?: string;
  displayOrder: number;
  
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenPrinter {
  id: string;
  name: string;
  type: 'network' | 'usb' | 'bluetooth';
  ipAddress?: string;
  port?: number;
  enabled: boolean;
}

// Analytics Types
export interface MenuAnalytics {
  menuId: string;
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  
  // Views
  totalViews: number;
  uniqueViews: number;
  avgViewDuration: number;
  
  // Items
  topViewedItems: { itemId: string; views: number; name: string }[];
  topOrderedItems: { itemId: string; orders: number; revenue: number; name: string }[];
  
  // Categories
  categoryPerformance: {
    categoryId: string;
    name: string;
    views: number;
    orders: number;
    revenue: number;
  }[];
  
  // Conversion
  viewToCartRate: number; // %
  cartToOrderRate: number; // %
  overallConversionRate: number; // %
  
  // Revenue
  totalRevenue: number;
  avgOrderValue: number;
  
  // Time Analysis
  peakHours: { hour: number; orders: number }[];
}

export interface MenuItemAnalytics {
  itemId: string;
  itemName: string;
  
  // Performance
  totalViews: number;
  totalOrders: number;
  totalRevenue: number;
  
  // Conversion
  viewToOrderRate: number;
  
  // Modifiers
  popularModifiers?: {
    modifierId: string;
    name: string;
    selections: number;
  }[];
  
  // Time patterns
  popularTimes: { hour: number; orders: number }[];
}

// Allergen definitions
export const ALLERGENS = [
  { id: 'gluten', name: 'Gluten', nameAr: 'جلوتين', icon: '🌾' },
  { id: 'dairy', name: 'Dairy', nameAr: 'ألبان', icon: '🥛' },
  { id: 'nuts', name: 'Nuts', nameAr: 'مكسرات', icon: '🥜' },
  { id: 'shellfish', name: 'Shellfish', nameAr: 'محار', icon: '🦐' },
  { id: 'eggs', name: 'Eggs', nameAr: 'بيض', icon: '🥚' },
  { id: 'soy', name: 'Soy', nameAr: 'صويا', icon: '🫘' },
  { id: 'fish', name: 'Fish', nameAr: 'سمك', icon: '🐟' },
  { id: 'sesame', name: 'Sesame', nameAr: 'سمسم', icon: '🌰' },
] as const;

// Dietary preferences
export const DIETARY_PREFERENCES = [
  { id: 'vegetarian', name: 'Vegetarian', nameAr: 'نباتي', icon: '🥗' },
  { id: 'vegan', name: 'Vegan', nameAr: 'نباتي صرف', icon: '🌱' },
  { id: 'halal', name: 'Halal', nameAr: 'حلال', icon: '☪️' },
  { id: 'gluten-free', name: 'Gluten Free', nameAr: 'خالي من الجلوتين', icon: '🌾' },
  { id: 'keto', name: 'Keto', nameAr: 'كيتو', icon: '🥑' },
  { id: 'low-carb', name: 'Low Carb', nameAr: 'قليل الكربوهيدرات', icon: '🥩' },
] as const;

// Kitchen routes presets
export const KITCHEN_ROUTES = [
  { id: 'grill', name: 'Grill Station', nameAr: 'مشاوي', color: '#ff6b6b' },
  { id: 'salad', name: 'Salad Bar', nameAr: 'سلطات', color: '#51cf66' },
  { id: 'dessert', name: 'Dessert Station', nameAr: 'حلويات', color: '#ff6b9d' },
  { id: 'bar', name: 'Bar', nameAr: 'مشروبات', color: '#339af0' },
  { id: 'hot', name: 'Hot Kitchen', nameAr: 'مطبخ ساخن', color: '#ff8c00' },
  { id: 'cold', name: 'Cold Kitchen', nameAr: 'مطبخ بارد', color: '#4dabf7' },
] as const;
