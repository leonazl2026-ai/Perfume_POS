import type { OrderChannelValue } from "@/lib/channels";

export type DeliveryStatusValue =
  | "NOT_REQUIRED"
  | "PENDING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "RETURNED";

export interface ExpenseCategoryOption {
  id: string;
  name: string;
  description: string | null;
}

export interface ExpenseRow {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  amount: number;
  expenseDate: string; // ISO — formatted in the client
}

export interface ExpenseCategoryTotal {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
}

export interface SaleRow {
  id: string;
  saleNumber: string;
  saleDate: string; // ISO
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string;
  orderChannel: OrderChannelValue;
  status: "COMPLETED" | "VOIDED";
  deliveryStatus: DeliveryStatusValue;
  courier: string | null;
  trackingNumber: string | null;
  deliveryAddress: string | null;
  itemCount: number;
  total: number;
  totalCost: number;
  totalProfit: number;
}

export interface SaleLineDetail {
  id: string;
  lineType: "FULL_BOTTLE" | "DECANT" | "BUNDLE";
  name: string;
  detail: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineProfit: number;
}

export interface SaleDetail extends SaleRow {
  subtotal: number;
  discount: number;
  tax: number;
  notes: string | null;
  lineItems: SaleLineDetail[];
}

/** The headline figures for a period. */
export interface FinancialSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  /** Gross profit minus operating expenses. */
  netProfit: number;
  saleCount: number;
  averageOrderValue: number;
}

export interface CustomerBreakdownRow {
  customerName: string | null;
  orderCount: number;
  totalSpend: number;
  totalProfit: number;
}
