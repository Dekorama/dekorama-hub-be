import { Invoice } from "./entities/invoice.entity";
import { User } from "../users/user.entity";
import { generateSalesDocumentPdf } from "../pdf/dekorama-pdf.shared";

function displayInvoiceNumber(invoiceNumber: string): string {
  const match = invoiceNumber.match(/(\d{5})$/);
  if (match) return `C${new Date().getFullYear().toString().slice(-2)}${match[1]}`;
  return invoiceNumber.replace(/DKM-INV-/i, "C");
}

export async function generateInvoicePdfBuffer(invoice: Invoice): Promise<Buffer> {
  const client = invoice.client as User;
  const displayNumber = displayInvoiceNumber(invoice.invoiceNumber);
  const createdAt =
    invoice.createdAt instanceof Date ? invoice.createdAt : new Date(invoice.createdAt);
  const subtotal = Number(invoice.subtotal);
  const taxRate = Number(invoice.taxRate);
  const taxAmount = Number(invoice.taxAmount);
  const total = Number(invoice.total);
  const bruto = subtotal;
  const discountTotal = 0;
  const isPaid = invoice.status === "paid";

  const lineItems = invoice.lineItems.map((item) => ({
    sku: item.productSku ?? "",
    description: item.description,
    brand: (item.productSku ?? "").split("-")[1] ?? "",
    quantity: item.quantity,
    unit: "UD",
    unitPrice: Number(item.unitPrice),
    discountPct: 0,
    lineTotal: Number(item.lineTotal),
  }));

  const originNote = invoice.orderId
    ? `Documento de Venta originado por Pedido ${invoice.orderId.slice(0, 8).toUpperCase()}`
    : undefined;

  return generateSalesDocumentPdf({
    documentNumber: displayNumber,
    documentTypeLabel: "Factura",
    title: "FACTURA DE CONTADO",
    issueDate: createdAt,
    client,
    sellerName:
      (invoice.creator as User)?.name?.split(" ")[0]?.toUpperCase() ?? "ADMIN",
    lineItems,
    bruto,
    discountTotal,
    subtotal,
    taxRate,
    taxAmount,
    total,
    originNote,
    paymentCash: isPaid ? total : 0,
    paymentTransfer: isPaid ? total : 0,
    paymentTransferRef: displayNumber,
    footerBarcode: `DKD${displayNumber}NSC 01`,
  });
}
