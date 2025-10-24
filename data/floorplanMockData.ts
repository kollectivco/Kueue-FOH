import { Zone, FloorPlan, TableStatus, TableShape, ReservationInfo } from '../types/floorplan';

// Table status color mappings
export const tableStatusColors = {
  [TableStatus.Available]: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-800'
  },
  [TableStatus.Occupied]: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-800'
  },
  [TableStatus.Reserved]: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-500',
    text: 'text-yellow-800'
  },
  [TableStatus.Dirty]: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-800'
  },
  [TableStatus.OutOfOrder]: {
    bg: 'bg-gray-50',
    border: 'border-gray-500',
    text: 'text-gray-800'
  }
};

// Table shape icons
export const tableShapeIcons = {
  [TableShape.Rectangle]: '⬜',
  [TableShape.Square]: '🟫',
  [TableShape.Round]: '⭕',
  [TableShape.Booth]: '🛋️',
  [TableShape.Chair]: '🪑',
  [TableShape.HighChair]: '🪑',
  [TableShape.BarCounter]: '🍸',
  [TableShape.Sofa]: '🛋️',
  [TableShape.Divider]: '🧱',
  [TableShape.Plant]: '🪴',
  [TableShape.Custom]: '📐'
};

// Sample zones
export const sampleZones: Zone[] = [
  {
    id: 'zone_main_dining',
    name: 'Main Dining',
    description: 'Primary dining area with comfortable seating',
    capacity: 48,
    isActive: true,
    tables: [
      {
        id: 'table_md_01',
        zoneId: 'zone_main_dining',
        name: 'T1',
        capacity: 4,
        status: TableStatus.Available,
        shape: TableShape.Square,
        position: { top: '100px', left: '150px' },
        size: { width: '80px', height: '80px' },
        rotation: 0,
        isVip: false,
        features: ['window_view']
      },
      {
        id: 'table_md_02',
        zoneId: 'zone_main_dining',
        name: 'T2',
        capacity: 2,
        status: TableStatus.Occupied,
        shape: TableShape.Round,
        position: { top: '150px', left: '280px' },
        size: { width: '70px', height: '70px' },
        rotation: 0,
        reservationId: 'res_001'
      },
      {
        id: 'table_md_03',
        zoneId: 'zone_main_dining',
        name: 'T3',
        capacity: 6,
        status: TableStatus.Reserved,
        shape: TableShape.Rectangle,
        position: { top: '250px', left: '200px' },
        size: { width: '120px', height: '80px' },
        rotation: 0,
        reservationId: 'res_002'
      },
      {
        id: 'table_md_04',
        zoneId: 'zone_main_dining',
        name: 'T4',
        capacity: 4,
        status: TableStatus.Available,
        shape: TableShape.Square,
        position: { top: '100px', left: '350px' },
        size: { width: '80px', height: '80px' },
        rotation: 45
      },
      {
        id: 'table_md_05',
        zoneId: 'zone_main_dining',
        name: 'T5',
        capacity: 8,
        status: TableStatus.Available,
        shape: TableShape.Rectangle,
        position: { top: '350px', left: '150px' },
        size: { width: '160px', height: '80px' },
        rotation: 0,
        isVip: true,
        features: ['privacy', 'wheelchair_accessible']
      }
    ],
    settings: {
      backgroundColor: '#ffffff',
      showGrid: true,
      gridSize: 20,
      maxZoom: 2,
      minZoom: 0.5
    }
  },
  {
    id: 'zone_terrace',
    name: 'Terrace',
    description: 'Outdoor seating with garden view',
    capacity: 24,
    isActive: true,
    tables: [
      {
        id: 'table_tr_01',
        zoneId: 'zone_terrace',
        name: 'O1',
        capacity: 4,
        status: TableStatus.Available,
        shape: TableShape.Round,
        position: { top: '80px', left: '120px' },
        size: { width: '80px', height: '80px' },
        rotation: 0,
        features: ['outdoor', 'umbrella']
      },
      {
        id: 'table_tr_02',
        zoneId: 'zone_terrace',
        name: 'O2',
        capacity: 2,
        status: TableStatus.Available,
        shape: TableShape.Round,
        position: { top: '80px', left: '280px' },
        size: { width: '70px', height: '70px' },
        rotation: 0,
        features: ['outdoor']
      },
      {
        id: 'table_tr_03',
        zoneId: 'zone_terrace',
        name: 'O3',
        capacity: 6,
        status: TableStatus.Available,
        shape: TableShape.Rectangle,
        position: { top: '220px', left: '150px' },
        size: { width: '120px', height: '80px' },
        rotation: 0,
        features: ['outdoor', 'umbrella']
      }
    ],
    settings: {
      backgroundColor: '#f0f8f0',
      showGrid: true,
      gridSize: 20,
      maxZoom: 2,
      minZoom: 0.5
    }
  },
  {
    id: 'zone_bar_lounge',
    name: 'Bar & Lounge',
    description: 'Cocktail tables and bar seating',
    capacity: 16,
    isActive: true,
    tables: [
      {
        id: 'table_bl_01',
        zoneId: 'zone_bar_lounge',
        name: 'B1',
        capacity: 2,
        status: TableStatus.Available,
        shape: TableShape.BarCounter,
        position: { top: '60px', left: '100px' },
        size: { width: '200px', height: '40px' },
        rotation: 0,
        features: ['bar_height']
      },
      {
        id: 'table_bl_02',
        zoneId: 'zone_bar_lounge',
        name: 'L1',
        capacity: 4,
        status: TableStatus.Available,
        shape: TableShape.Sofa,
        position: { top: '150px', left: '80px' },
        size: { width: '100px', height: '100px' },
        rotation: 0,
        features: ['lounge']
      },
      {
        id: 'table_bl_03',
        zoneId: 'zone_bar_lounge',
        name: 'L2',
        capacity: 6,
        status: TableStatus.Dirty,
        shape: TableShape.Sofa,
        position: { top: '150px', left: '220px' },
        size: { width: '120px', height: '100px' },
        rotation: 0,
        features: ['lounge']
      }
    ],
    settings: {
      backgroundColor: '#fff8f0',
      showGrid: true,
      gridSize: 20,
      maxZoom: 2,
      minZoom: 0.5
    }
  }
];

// Sample floor plan
export const sampleFloorPlan: FloorPlan = {
  id: 'floorplan_main',
  organizationId: 'demo_org',
  branchId: 'demo_branch',
  name: 'Main Restaurant Layout',
  description: 'Complete floor plan for the main restaurant location',
  zones: sampleZones,
  settings: {
    defaultGridSize: 20,
    defaultZoom: 1,
    snapToGrid: true,
    showLabels: true,
    theme: 'light'
  },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: new Date().toISOString(),
  createdBy: 'demo_user'
};

// Sample reservations for tables
export const sampleReservations: ReservationInfo[] = [
  {
    id: 'res_001',
    tableId: 'table_md_02',
    guestName: 'Ahmed Al-Rashid',
    guestEmail: 'ahmed@example.com',
    guestPhone: '+966501234567',
    partySize: 2,
    date: '2025-01-07',
    time: '19:30',
    status: 'seated',
    specialRequests: 'Anniversary dinner, please prepare something special',
    estimatedDuration: 120
  },
  {
    id: 'res_002',
    tableId: 'table_md_03',
    guestName: 'Sarah Johnson',
    guestEmail: 'sarah@example.com',
    guestPhone: '+1-555-0123',
    partySize: 6,
    date: '2025-01-07',
    time: '20:00',
    status: 'confirmed',
    specialRequests: 'Business dinner with international clients',
    estimatedDuration: 150
  },
  {
    id: 'res_003',
    tableId: 'table_md_01',
    guestName: 'Omar Hassan',
    guestEmail: 'omar@example.com',
    guestPhone: '+966509876543',
    partySize: 4,
    date: '2025-01-06',
    time: '18:00',
    status: 'completed',
    specialRequests: 'Family dinner',
    estimatedDuration: 90
  },
  {
    id: 'res_004',
    tableId: 'table_bl_03',
    guestName: 'Emma Wilson',
    guestEmail: 'emma@example.com',
    guestPhone: '+44-7700-900123',
    partySize: 4,
    date: '2025-01-06',
    time: '21:30',
    status: 'no_show',
    specialRequests: 'Cocktail party',
    estimatedDuration: 180
  }
];