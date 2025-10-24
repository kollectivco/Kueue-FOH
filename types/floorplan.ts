// Floor Plan Types for Kueue RSVP
export interface Position {
  top: string;
  left: string;
}

export interface Size {
  width: string;
  height: string;
}

export enum TableStatus {
  Available = 'Available',
  Occupied = 'Occupied', 
  Reserved = 'Reserved',
  Dirty = 'Dirty',
  OutOfOrder = 'Out of Order'
}

export enum TableShape {
  Rectangle = 'rectangle',
  Square = 'square',
  Round = 'round',
  Booth = 'booth',
  Chair = 'chair',
  HighChair = 'high-chair',
  BarCounter = 'bar-counter',
  Sofa = 'sofa',
  Divider = 'divider',
  Plant = 'plant',
  Custom = 'custom'
}

export interface Table {
  id: string;
  zoneId: string;
  name: string;
  capacity: number;
  status: TableStatus;
  shape: TableShape;
  position: Position;
  size: Size;
  rotation: number;
  reservationId?: string;
  notes?: string;
  isVip?: boolean;
  features?: string[]; // e.g., ['window_view', 'near_kitchen', 'wheelchair_accessible']
}

export interface Zone {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  isActive: boolean;
  tables: Table[];
  settings?: {
    backgroundColor?: string;
    backgroundImage?: string;
    showGrid?: boolean;
    gridSize?: number;
    maxZoom?: number;
    minZoom?: number;
  };
}

export interface FloorPlan {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  description?: string;
  zones: Zone[];
  settings: {
    defaultGridSize: number;
    defaultZoom: number;
    snapToGrid: boolean;
    showLabels: boolean;
    theme: 'light' | 'dark';
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ReservationInfo {
  id: string;
  tableId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  specialRequests?: string;
  estimatedDuration: number; // in minutes
}

export interface TableOperation {
  type: 'add' | 'update' | 'delete' | 'move' | 'resize' | 'rotate';
  tableId: string;
  data?: Partial<Table>;
  timestamp: string;
  userId: string;
}