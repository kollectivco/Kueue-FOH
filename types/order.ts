// Order & Cart Types for Digital Menu System

import { MenuItem, MenuModifier, ModifierOption } from './menu';

export type OrderStatus = 
  | 'pending'      // Just placed, waiting confirmation
  | 'confirmed'    // Confirmed by restaurant
  | 'preparing'    // Being prepared in kitchen
  | 'ready'        // Ready for pickup/serving
  | 'served'       // Delivered to table
  | 'completed'    // Finished
  | 'cancelled';   // Cancelled

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface CartItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNameAr?: string;
  
  // Pricing
  basePrice: number;
  itemTotal: number; // basePrice + modifiers
  lineTotal: number; // itemTotal × quantity
  
  // Quantity
  quantity: number;
  
  // Modifiers Selected
  selectedModifiers?: SelectedModifier[];
  
  // Special Instructions
  notes?: string;
  
  // Item Details (cached from MenuItem)
  photo?: string;
  category?: string;
  allergens?: string[];
  
  // Kitchen
  kitchenRoute?: string;
  prepTime?: number;
  
  addedAt: string;
}

export interface SelectedModifier {
  modifierId: string;
  modifierName: string;
  modifierNameAr?: string;
  type: 'single' | 'multiple';
  
  // Selected Options
  selectedOptions: SelectedModifierOption[];
  
  // Total price adjustment from this modifier
  totalAdjustment: number;
}

export interface SelectedModifierOption {
  optionId: string;
  optionName: string;
  optionNameAr?: string;
  priceAdjustment: number;
}

export interface Cart {
  id: string;
  menuId: string;
  orgId: string;
  
  // Items
  items: CartItem[];
  
  // Guest Info (optional at cart stage)
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  
  // Table Context
  tableId?: string;
  tableNumber?: string;
  zoneId?: string;
  zoneName?: string;
  
  // Pricing
  subtotal: number;
  tax?: number;
  taxRate?: number;
  serviceCharge?: number;
  serviceChargeRate?: number;
  discount?: number;
  total: number;
  
  // Session
  sessionId?: string;
  qrLinkId?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface Order {
  id: string;
  orderNumber?: string; // Human-readable: #0001, #0002
  orgId: string;
  menuId: string;
  
  // Items
  items: CartItem[];
  
  // Guest Information
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  
  // Table Context
  tableId?: string;
  tableNumber?: string;
  zoneId?: string;
  zoneName?: string;
  branchId?: string;
  
  // Pricing
  subtotal: number;
  tax: number;
  taxRate: number;
  serviceCharge: number;
  serviceChargeRate: number;
  discount?: number;
  discountReason?: string;
  total: number;
  currency: string;
  
  // Status
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  statusHistory: OrderStatusChange[];
  
  // Kitchen
  kitchenRoutes: string[]; // Which kitchen stations need this order
  kitchenNotes?: string;
  
  // Special Instructions
  orderNotes?: string;
  allergiesNoted?: string[];
  
  // Timing
  orderedAt: string;
  confirmedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  servedAt?: string;
  completedAt?: string;
  
  // Source
  source: 'qr_menu' | 'staff' | 'pos' | 'online';
  qrLinkId?: string;
  sessionId?: string;
  
  // Staff Assignment
  assignedTo?: string; // Staff member ID
  assignedToName?: string;
  
  // Payment
  paymentMethod?: 'cash' | 'card' | 'online' | 'pending';
  paymentIntentId?: string;
  paidAt?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface OrderStatusChange {
  status: OrderStatus;
  timestamp: string;
  changedBy: string; // User ID or 'system'
  changedByName?: string;
  notes?: string;
}

export interface OrderKitchenView {
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  
  // Items for this kitchen station
  items: CartItem[];
  
  // Status specific to this station
  stationStatus: 'pending' | 'preparing' | 'ready';
  
  // Timing
  orderedAt: string;
  prepTime: number; // Total estimated prep time
  
  // Priority
  priority: 'normal' | 'urgent' | 'delayed';
  
  // Notes
  kitchenNotes?: string;
  allergies?: string[];
}

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  guestName: string;
  
  // Quick Info
  itemCount: number;
  total: number;
  status: OrderStatus;
  
  // Timing
  orderedAt: string;
  estimatedReadyTime?: string;
  
  // Flags
  hasAllergyNotes: boolean;
  hasSpecialInstructions: boolean;
  isPaid: boolean;
}

// Analytics Types
export interface OrderAnalytics {
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  
  // Volume
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  
  // Revenue
  totalRevenue: number;
  avgOrderValue: number;
  
  // Conversion
  viewsToOrders: number; // From MenuView analytics
  conversionRate: number;
  
  // Items
  totalItemsSold: number;
  avgItemsPerOrder: number;
  
  // Timing
  avgPrepTime: number; // minutes
  avgOrderToServed: number; // minutes
  
  // Popular
  popularItems: {
    itemId: string;
    itemName: string;
    quantity: number;
    revenue: number;
  }[];
  
  // By Time
  ordersByHour: { hour: number; orders: number; revenue: number }[];
  
  // By Table/Zone
  ordersByZone?: { zoneId: string; zoneName: string; orders: number; revenue: number }[];
}

export interface KitchenPerformance {
  routeId: string;
  routeName: string;
  
  // Volume
  totalOrders: number;
  completedOrders: number;
  
  // Timing
  avgPrepTime: number;
  minPrepTime: number;
  maxPrepTime: number;
  
  // Efficiency
  onTimeRate: number; // % of orders ready within estimated time
  
  // Current
  activeOrders: number;
  queuedOrders: number;
}

// Revenue Breakdown
export interface RevenueBreakdown {
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discounts: number;
  total: number;
  
  // Payment Methods
  cash: number;
  card: number;
  online: number;
  pending: number;
}

// Guest Order History
export interface GuestOrderHistory {
  guestPhone: string;
  guestEmail?: string;
  guestName?: string;
  
  // Statistics
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  
  // Preferences
  favoriteItems: {
    itemId: string;
    itemName: string;
    orderCount: number;
  }[];
  
  commonModifiers?: string[];
  allergyNotes?: string[];
  
  // Last Order
  lastOrderDate: string;
  lastOrderTotal: number;
  
  // Loyalty
  lifetimeValue: number;
  frequencyDays?: number; // Avg days between orders
}

// Order Queue Item (for KDS)
export interface OrderQueueItem {
  orderId: string;
  orderNumber: string;
  
  // Display Info
  tableNumber?: string;
  guestName?: string;
  
  // Items
  itemCount: number;
  items: CartItem[];
  
  // Status
  status: OrderStatus;
  
  // Timing
  orderedAt: string;
  estimatedReadyTime: string;
  timeElapsed: number; // minutes since ordered
  
  // Priority
  priority: 'normal' | 'urgent' | 'delayed';
  isOverdue: boolean;
  
  // Flags
  hasAllergyNotes: boolean;
  hasSpecialInstructions: boolean;
  notes?: string;
}

// Print Job for Kitchen Printer
export interface KitchenPrintJob {
  orderId: string;
  orderNumber: string;
  printerId: string;
  
  // Content
  items: CartItem[];
  notes?: string;
  allergies?: string[];
  
  // Context
  tableNumber?: string;
  guestName?: string;
  
  // Status
  printed: boolean;
  printedAt?: string;
  retryCount: number;
  
  // Metadata
  createdAt: string;
}
