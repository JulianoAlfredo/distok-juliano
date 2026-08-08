/** Tipos do contrato de API do drill-down do Dashboard.
 *  Fonte única de verdade: contrato acordado com o construtor-api (rotas
 *  /dashboard/drilldown/** e /dashboard/trends/**). Todo campo de dinheiro
 *  já vem numérico do backend — nunca faça Number() de novo, só formate. */

/** Envelope padrão de toda rota de lista de drill-down. */
export interface DrilldownEnvelope<TItem, TSummary = undefined> {
  items: TItem[];
  total: number;
  page: number;
  pages: number;
  summary?: TSummary;
}

// ---------- /dashboard/drilldown/out-of-stock ----------
export interface OutOfStockFilters {
  search: string;
  category: string;
}
export interface OutOfStockItem {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  current_stock: number;
  min_stock: number;
}

// ---------- /dashboard/drilldown/below-min ----------
export interface BelowMinFilters {
  search: string;
  category: string;
}
export interface BelowMinItem {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  current_stock: number;
  min_stock: number;
  missing: number;
}

// ---------- /dashboard/drilldown/sales ----------
export type SalesPeriod = 'today' | 'month' | 'custom';
export type SaleStatus = 'open' | 'cancelled';

export interface SalesFilters {
  period: SalesPeriod;
  dateFrom: string;
  dateTo: string;
  search: string;
  paymentMethod: string;
  includeCancelled: boolean;
}
export interface SaleItem {
  id: string;
  number: number | string;
  sold_at: string;
  customer_name: string | null;
  customer_id: string | null;
  items_count: number;
  units_count: number;
  payment_method: string;
  total: number;
  status: SaleStatus;
}
export interface SalesSummary {
  totalAmount: number;
  count: number;
}

// ---------- /dashboard/drilldown/financial ----------
export type FinancialType = 'receivable' | 'payable';
export type FinancialSituationFilter = 'pending' | 'overdue' | 'upcoming' | 'paid' | 'all';
export type FinancialSituation = 'overdue' | 'upcoming' | 'paid' | 'cancelled';
export type PartyType = 'supplier' | 'customer' | null;

export interface FinancialFilters {
  type: FinancialType;
  situation: FinancialSituationFilter;
  search: string;
  dateFrom: string;
  dateTo: string;
  includeCancelled: boolean;
}
export interface FinancialItem {
  id: string;
  description: string;
  party_name: string | null;
  party_type: PartyType;
  customer_name: string | null;
  supplier_name: string | null;
  due_date: string;
  amount: number;
  status: string;
  is_overdue: boolean;
  days_overdue: number;
  situation: FinancialSituation;
}
export interface FinancialSummary {
  totalAmount: number;
  count: number;
  overdueAmount: number;
  overdueCount: number;
}

// ---------- /dashboard/drilldown/stock-value ----------
export type StockValueSort = 'value' | 'name' | 'qty';
export type SortDir = 'asc' | 'desc';

export interface StockValueFilters {
  search: string;
  category: string;
  sort: StockValueSort;
  dir: SortDir;
}
export interface StockValueItem {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  current_stock: number;
  cost_price: number;
  total_value: number;
}
export interface StockValueSummary {
  totalValue: number;
}

// ---------- /dashboard/trends/movements ----------
export interface MovementsTrendPoint {
  day: string;
  entry: number;
  exit: number;
  adjustment: number;
}
export interface MovementsTrend {
  days: number;
  from: string;
  to: string;
  series: MovementsTrendPoint[];
}

// ---------- /dashboard/trends/revenue ----------
export interface RevenueTrendPoint {
  day: string;
  total: number;
  count: number;
}
export interface RevenueTrend {
  days: number;
  from: string;
  to: string;
  series: RevenueTrendPoint[];
}

// ---------- Top 5 mais vendidos (vem de /dashboard/summary, sem endpoint novo) ----------
export interface BestSeller {
  id: string;
  name: string;
  qty_sold: number;
  revenue: number;
}
