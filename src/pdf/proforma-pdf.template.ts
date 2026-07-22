import { MaterialList } from "../material-lists/material-list.entity";
import { Proposal, ProposalType } from "../proposals/proposal.entity";
import { ProposalSection } from "../proposals/entities/proposal-section.entity";
import { User } from "../users/user.entity";
import {
  boxesForM2,
  displayUnit,
  lineNetTotal,
  normalizeUnit,
} from "../common/line-item.utils";
import {
  SalesDocumentLineItem,
  generateSalesDocumentPdf,
} from "./dekorama-pdf.shared";

export interface ProductPackaging {
  piecesPerBox: number | null;
  unitPerPiece: number | null;
}

function displayProformaNumber(proposal: Proposal): string {
  const seq = proposal.id.replace(/\D/g, "").slice(-5).padStart(5, "0");
  const yy = new Date(proposal.createdAt).getFullYear().toString().slice(-2);
  return `C${yy}${seq}`;
}

function m2BoxSubNote(
  quantity: number,
  packaging?: ProductPackaging | null,
): string | undefined {
  if (!packaging) return undefined;
  const pieces = Number(packaging.piecesPerBox);
  // DB column `unitPerPiece` = cobertura total de la caja (m²/caja), no por pieza.
  const m2PorCaja = Number(packaging.unitPerPiece);
  if (!Number.isFinite(pieces) || pieces < 1) return undefined;
  if (!Number.isFinite(m2PorCaja) || m2PorCaja <= 0) return undefined;

  const boxes = boxesForM2(quantity, m2PorCaja);
  return `Equivale a ${boxes} caja(s) (${m2PorCaja.toFixed(4)} m²/caja · ${pieces} pz)`;
}

function materialToLineItem(
  material: MaterialList,
  packagingBySku: Map<string, ProductPackaging>,
): SalesDocumentLineItem {
  const unitPrice = Number(material.suggestedPrice);
  const quantity = Number(material.quantity);
  const discountPct = Number(material.discountPct) || 0;
  const net = lineNetTotal(quantity, unitPrice, discountPct);
  const unitNorm = normalizeUnit(material.unit);
  const packaging = packagingBySku.get(material.productSku);
  const subNote =
    unitNorm === "m2" ? m2BoxSubNote(quantity, packaging) : undefined;

  return {
    sku: material.productSku,
    description: material.productName,
    brand: material.productSku.split("-")[1] ?? "",
    quantity,
    unit: displayUnit(material.unit),
    unitPrice,
    discountPct,
    lineTotal: net,
    subNote,
  };
}

function buildLineItems(
  materials: MaterialList[],
  sections: ProposalSection[],
  laborCost: number,
  packagingBySku: Map<string, ProductPackaging>,
): SalesDocumentLineItem[] {
  const items: SalesDocumentLineItem[] = [];
  const usedIds = new Set<string>();

  const orderedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const section of orderedSections) {
    const sectionMaterials = materials.filter((m) => m.sectionId === section.id);
    if (sectionMaterials.length === 0) continue;

    items.push({
      sku: "",
      description: section.name,
      quantity: 0,
      unit: "",
      unitPrice: 0,
      discountPct: 0,
      lineTotal: 0,
      isSectionHeader: true,
    });

    for (const material of sectionMaterials) {
      usedIds.add(material.id);
      items.push(materialToLineItem(material, packagingBySku));
    }
  }

  const unsectioned = materials.filter((m) => !usedIds.has(m.id));
  if (unsectioned.length > 0 && orderedSections.length > 0) {
    items.push({
      sku: "",
      description: "Sin sección",
      quantity: 0,
      unit: "",
      unitPrice: 0,
      discountPct: 0,
      lineTotal: 0,
      isSectionHeader: true,
    });
  }
  for (const material of unsectioned) {
    items.push(materialToLineItem(material, packagingBySku));
  }

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
  sections: ProposalSection[] = [],
  packagingBySku: Map<string, ProductPackaging> = new Map(),
): Promise<Buffer> {
  const documentNumber = displayProformaNumber(proposal);
  const issueDate =
    proposal.createdAt instanceof Date
      ? proposal.createdAt
      : new Date(proposal.createdAt);
  const lineItems = buildLineItems(
    materials,
    sections,
    Number(proposal.laborCost),
    packagingBySku,
  );

  const bruto =
    materials.reduce((sum, m) => {
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
