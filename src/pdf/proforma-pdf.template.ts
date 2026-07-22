import { MaterialList } from "../material-lists/material-list.entity";
import { Proposal, ProposalType } from "../proposals/proposal.entity";
import { User } from "../users/user.entity";
import {
  displayUnit,
  lineNetTotal,
} from "../common/line-item.utils";
import {
  SalesDocumentLineItem,
  generateSalesDocumentPdf,
} from "./dekorama-pdf.shared";

function displayProformaNumber(proposal: Proposal): string {
  const seq = proposal.id.replace(/\D/g, "").slice(-5).padStart(5, "0");
  const yy = new Date(proposal.createdAt).getFullYear().toString().slice(-2);
  return `C${yy}${seq}`;
}

function buildLineItems(
  materials: MaterialList[],
  laborCost: number,
): SalesDocumentLineItem[] {
  const items: SalesDocumentLineItem[] = materials.map((material) => {
    const unitPrice = Number(material.suggestedPrice);
    const quantity = Number(material.quantity);
    const discountPct = Number(material.discountPct) || 0;
    const net = lineNetTotal(quantity, unitPrice, discountPct);
    return {
      sku: material.productSku,
      description: material.productName,
      brand: material.productSku.split("-")[1] ?? "",
      quantity,
      unit: displayUnit(material.unit),
      unitPrice,
      discountPct,
      lineTotal: net,
    };
  });

  if (laborCost > 0) {
    items.push({
      sku: "MO000001",
      description: "MANO DE OBRA",
      brand: "",
      quantity: 1,
      unit: "UD",
      unitPrice: laborCost,
      discountPct: 0,
      lineTotal: laborCost,
    });
  }

  return items;
}

export async function generateProformaPdfBuffer(
  proposal: Proposal,
  client: User,
  materials: MaterialList[],
  taxRate: number,
): Promise<Buffer> {
  const documentNumber = displayProformaNumber(proposal);
  const issueDate =
    proposal.createdAt instanceof Date ? proposal.createdAt : new Date(proposal.createdAt);
  const lineItems = buildLineItems(materials, Number(proposal.laborCost));

  const bruto = materials.reduce((sum, m) => {
    return sum + Number(m.suggestedPrice) * Number(m.quantity);
  }, 0) + Number(proposal.laborCost || 0);

  const discountTotal = materials.reduce((sum, m) => {
    const lineBruto = Number(m.suggestedPrice) * Number(m.quantity);
    const net = lineNetTotal(
      Number(m.quantity),
      Number(m.suggestedPrice),
      m.discountPct,
    );
    return sum + (lineBruto - net);
  }, 0);

  const subtotal = bruto - discountTotal;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const seller =
    (proposal.professional as User | null)?.name ??
    (proposal.createdBy as User | null)?.name ??
    "ADMIN";

  const originNote = proposal.project
    ? `Documento de Venta originado por Proyecto ${proposal.project.title}`
    : proposal.type === ProposalType.SOLICITUD
      ? `Documento de Venta originado por Solicitud ${proposal.id.slice(0, 8).toUpperCase()}`
      : undefined;

  return generateSalesDocumentPdf({
    documentNumber,
    documentTypeLabel: "Proforma",
    title: "PROFORMA",
    issueDate,
    client,
    sellerName: seller.split(" ")[0]?.toUpperCase() ?? "ADMIN",
    department: proposal.project?.title,
    lineItems,
    bruto,
    discountTotal,
    subtotal,
    taxRate,
    taxAmount,
    total,
    originNote,
    paymentCash: 0,
    paymentTransfer: 0,
    paymentTransferRef: documentNumber,
    footerBarcode: `DKD${documentNumber}NSC 01`,
  });
}
