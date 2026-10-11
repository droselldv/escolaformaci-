export interface RawLumaGuest {
  guest_id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  created_at: string;
  approval_status: string;
  ticket_name: string;
  comarca: string;
  municipi: string;
  dish_raw: string;
  amount?: string;
  currency?: string;
}

export interface ProcessedGuest extends RawLumaGuest {
  staysForLunch: boolean;
  cleanDish: string;
  tableNumber?: number; // 1, 2, 3...
  seatNumber?: number;  // 1 to 10
  registrationOrder: number; // 1 to N
}

export interface DishTotal {
  dish: string;
  count: number;
  percentage: number;
}

export interface TableGroup {
  tableNumber: number;
  capacity: number;
  guests: ProcessedGuest[];
  dishCounts: Record<string, number>;
}

export interface ManualGuestOverride {
  stays?: boolean;
  dish?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
}

export type ManualOverridesMap = Record<string, ManualGuestOverride>;

export interface TableAssignment {
  tableNumber: number | null; // null indicates unassigned
  seatNumber?: number | null;
}

export type TableAssignmentsMap = Record<string, TableAssignment>;

export interface EventAnalysis {
  allGuests: ProcessedGuest[];
  lunchGuests: ProcessedGuest[];
  noLunchGuests: ProcessedGuest[];
  unassignedGuests: ProcessedGuest[];
  tables: TableGroup[];
  dishTotals: DishTotal[];
  totalRegistered: number;
  totalLunch: number;
  totalNoLunch: number;
  totalTables: number;
  updatedAt: string;
}

export type AvailableColumnId =
  | 'table'
  | 'seat'
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'dish'
  | 'phone'
  | 'email'
  | 'comarca'
  | 'municipi'
  | 'created_at'
  | 'ticket'
  | 'status';

export interface ColumnDefinition {
  id: AvailableColumnId;
  label: string;
  shortLabel: string;
  category: 'taula' | 'personal' | 'contacte' | 'altres';
  defaultEnabled: boolean;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Nom complet (Cognoms, Nom)', shortLabel: 'Nom complet', category: 'personal', defaultEnabled: true },
  { id: 'table', label: 'Taula assignada', shortLabel: 'Taula', category: 'taula', defaultEnabled: true },
  { id: 'seat', label: 'Seient (1 a 10)', shortLabel: 'Seient', category: 'taula', defaultEnabled: false },
  { id: 'dish', label: 'Segon Plat demanat', shortLabel: 'Plat', category: 'taula', defaultEnabled: false },
  { id: 'municipi', label: 'Municipi', shortLabel: 'Municipi', category: 'contacte', defaultEnabled: true },
  { id: 'comarca', label: 'Comarca', shortLabel: 'Comarca', category: 'contacte', defaultEnabled: true },
  { id: 'phone', label: 'Telèfon', shortLabel: 'Telèfon', category: 'contacte', defaultEnabled: false },
  { id: 'email', label: 'Correu electrònic', shortLabel: 'Email', category: 'contacte', defaultEnabled: false },
  { id: 'first_name', label: 'Nom', shortLabel: 'Nom', category: 'personal', defaultEnabled: false },
  { id: 'last_name', label: 'Cognoms', shortLabel: 'Cognoms', category: 'personal', defaultEnabled: false },
  { id: 'created_at', label: 'Data inscripció', shortLabel: 'Data', category: 'altres', defaultEnabled: false },
  { id: 'ticket', label: 'Tipus entrada', shortLabel: 'Entrada', category: 'altres', defaultEnabled: false },
  { id: 'status', label: 'Estat aprovació', shortLabel: 'Estat', category: 'altres', defaultEnabled: false },
];

export type SortKey =
  | 'table_seat'
  | 'alpha_name'
  | 'alpha_lastname'
  | 'registration_date'
  | 'dish'
  | 'municipi'
  | 'comarca';

export interface CustomExportOptions {
  columns: AvailableColumnId[];
  sortBy: SortKey;
  sortDirection: 'asc' | 'desc';
  groupByTables: boolean;
  includeNoLunchSheet: boolean;
  includeKitchenSummarySheet: boolean;
}
