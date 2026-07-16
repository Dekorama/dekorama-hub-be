export interface SupplierPreviewLine {
  lineItemId: string;
  productSku: string;
  quantityPending: number;
  primarySupplier?: { id: string; name: string };
  factoryCode?: string;
  unitCost?: number;
  warning?: "no_primary_supplier" | "already_fully_sent";
}

export interface SupplierPreviewGroup {
  supplier: { id: string; name: string; email: string };
  lines: SupplierPreviewLine[];
  estimatedTotal: number;
}

export interface SupplierPreviewResponse {
  clientOrder: {
    id: string;
    orderNumber: string;
    clientName: string;
    status: string;
  };
  pendingLines: SupplierPreviewLine[];
  groups: SupplierPreviewGroup[];
  unmappedSkus: string[];
  existingSupplierOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    supplierName: string;
  }>;
}

export interface GenerateAllSupplierOrdersResult {
  created: SupplierOrderSummary[];
  skipped: Array<{ sku: string; reason: string }>;
}

export interface SupplierOrderSummary {
  id: string;
  orderNumber: string;
  supplierId: string;
  status: string;
}
