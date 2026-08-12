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
  status: "COMPLETED" | "VOIDED" | "RETURNED";
  deliveryStatus: DeliveryStatusValue;
  courier: string | null;
  trackingNumber: string | null;
  deliveryAddress: string | null;
  itemCount: number;
  /** Distinct batch IDs in this sale, for at-a-glance traceability. */
  batchIds: string[];
  total: number;
  totalCost: number;
  totalProfit: number;
}

export interface SaleLineDetail {
  id: string;
  lineType: "FULL_BOTTLE" | "DECANT" | "BUNDLE";
  name: string;
  detail: string;
  /** Originating batch — null for bundle lines, which span several batches. */
  batchId: string | null;
  supplierName: string | null;
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

export interface HandleReturnResult {
  condition: "RETURNED_GOOD" | "RETURNED_DAMAGED";
  /** Value written off; 0 for a good-condition return. */
  lossValue: number;
  restockedVariants: number;
}

export interface WastageRow {
  id: string;
  createdAt: string; // ISO
  productName: string;
  variantBatchId: string;
  supplierName: string | null;
  reason: string;
  mlDeducted: number;
  bottlesDeducted: number;
  lossValue: number;
  note: string | null;
  /** Non-null once reverted: stock restored and the expense withdrawn. */
  voidedAt: string | null;
}

export interface CustomerBreakdownRow {
  customerName: string | null;
  orderCount: number;
  totalSpend: number;
  totalProfit: number;
}
