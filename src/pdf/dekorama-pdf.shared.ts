import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { User } from "../users/user.entity";

type PdfDoc = InstanceType<typeof PDFDocument>;

export const COMPANY = {
  address: "AVENIDA TIVOLI 17 CENTRO COM. LAS VENTAS, LOCAL 5",
  city: "29631 - BENALMADENA (MALAGA)",
  phone: "952561669  628571537",
  email: "info@grupodekorama.com",
  web: "www.dekoramagroup.com",
  legalName: "ARISHA DESIGN, S.C.",
  nif: "J67676106",
  warehouse: "ALMACEN CENTRAL",
  rgpdEmail: "fcravelo@grupodekorama.com",
};

export const RGPD_TEXT =
  "De acuerdo a lo establecido en el RGPD, le informamos que trataremos sus datos personales con el fin de realizar la gestion administrativa, contable y fiscal, asi como enviarle comunicaciones comerciales de nuestros productos y servicios. Los datos proporcionados se conservaran mientras se mantenga la relacion comercial o durante el tiempo estipulado por ley. Los datos no se cederan a terceros salvo en casos en que exista una obligacion legal y los trataremos en base a su consentimiento o la ejecucion de un contrato o por ley. Podra ejercitar los derechos de acceso, cambio, supresion u olvido, limitacion, oposicion, portabilidad y cancelacion solicitandolo por escrito al responsable de datos al email fcravelo@grupodekorama.com y/o al domicilio fiscal de nuestra empresa. El interesado puede dirigirse a la Autoridad de Control de Proteccion de Datos competente para obtener informacion adicional o presentar una reclamacion.";

let logoBufferPromise: Promise<Buffer | null> | null = null;

export async function loadLogoBuffer(): Promise<Buffer | null> {
  if (!logoBufferPromise) {
    logoBufferPromise = (async () => {
      const svgPath = path.resolve(
        __dirname,
        "../../../dekorama-fe/public/logo/dekorama-logo.svg",
      );
      const localPath = path.resolve(__dirname, "../../assets/dekorama-logo.svg");
      const logoPath = fs.existsSync(svgPath) ? svgPath : localPath;
      if (!fs.existsSync(logoPath)) return null;
      return sharp(logoPath).resize(220, null).png().toBuffer();
    })();
  }
  return logoBufferPromise;
}

export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yy} (${hh}:${min})`;
}

export function formatMoney(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  dni: "DNI",
  nie: "NIE",
  nif: "NIF",
  cif: "CIF",
  cedula: "Cédula",
  rif: "RIF",
};

export function getClientProfile(client: User): {
  phone: string;
  address: string;
  city: string;
  province: string;
  clientCode: string;
  documentType: string;
  documentNumber: string;
  documentLabel: string;
} {
  const pd = (client.profileData ?? {}) as Record<string, string>;
  const documentType = (pd.documentType ?? "").toLowerCase();
  const documentNumber =
    pd.documentNumber ??
    pd.nif ??
    pd.cif ??
    pd.rif ??
    pd.cedula ??
    pd.dni ??
    pd.nie ??
    "";
  const documentLabel = documentType
    ? DOCUMENT_TYPE_LABELS[documentType] ?? documentType.toUpperCase()
    : documentNumber
      ? "NIF"
      : "";

  return {
    phone: pd.phone ?? pd.telefono ?? "",
    address: pd.address ?? pd.direccion ?? "",
    city: pd.city ?? pd.locality ?? pd.localidad ?? "",
    province: pd.province ?? pd.provincia ?? "",
    clientCode: pd.clientCode ?? client.id.slice(0, 5).toUpperCase(),
    documentType,
    documentNumber,
    documentLabel,
  };
}

export function drawBox(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  label?: string,
  value?: string,
  valueSize = 9,
): void {
  doc.rect(x, y, w, h).stroke("#000000");
  if (label) {
    doc.fontSize(6).font("Helvetica").text(label, x + 3, y + 2, {
      width: w - 6,
      height: 8,
      lineBreak: false,
    });
  }
  if (value) {
    doc.fontSize(valueSize).font("Helvetica-Bold").text(value, x + 3, y + (label ? 10 : 4), {
      width: w - 6,
      height: h - (label ? 12 : 6),
      align: "center",
      lineBreak: false,
      ellipsis: true,
    });
  }
}

export interface SalesDocumentLineItem {
  sku: string;
  description: string;
  brand?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  subNote?: string;
  /** When true, render as a section header row spanning the table */
  isSectionHeader?: boolean;
}

export interface SalesDocumentData {
  documentNumber: string;
  documentTypeLabel: string;
  title: string;
  issueDate: Date;
  client: User;
  sellerName: string;
  department?: string;
  lineItems: SalesDocumentLineItem[];
  bruto: number;
  discountTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  originNote?: string;
  paymentCash?: number;
  paymentTransfer?: number;
  paymentTransferRef?: string;
  footerBarcode?: string;
}

export async function generateSalesDocumentPdf(data: SalesDocumentData): Promise<Buffer> {
  const logo = await loadLogoBuffer();
  const profile = getClientProfile(data.client);

  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 28 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const left = 28;
    const right = pageW - 28;
    const contentW = right - left;
    const bottomMargin = 28;
    const printableBottom = pageH - bottomMargin;
    const pageFooterY = printableBottom - 22;

    doc.fontSize(5).font("Helvetica");
    const rgpdHeight = doc.heightOfString(RGPD_TEXT, {
      width: contentW,
      align: "justify",
      lineGap: 1,
    });

    const totalsBlockHeight = 148;
    const footerGap = 10;
    const rgpdY = pageFooterY - rgpdHeight - 8;
    const footerTop = rgpdY - footerGap - totalsBlockHeight;
    const originNoteReserve = data.originNote ? 16 : 0;
    const maxTableBottom = footerTop - originNoteReserve - 8;

    const LOGO_W = 130;
    const LOGO_H = 36;
    let y = 28;

    if (logo) {
      doc.image(logo, left, y, { fit: [LOGO_W, LOGO_H] });
    } else {
      doc.fontSize(20).font("Helvetica-Bold").text("DEKORAMA", left, y);
    }

    doc.fontSize(8).font("Helvetica-Bold");
    doc.text(COMPANY.legalName, right - 190, y, { width: 190, align: "right" });
    doc.font("Helvetica").fontSize(7).text(`NIF ${COMPANY.nif}`, right - 190, y + 12, {
      width: 190,
      align: "right",
    });

    y += LOGO_H + 10;
    doc.fontSize(7).font("Helvetica");
    doc.text(COMPANY.address, left, y, { width: contentW * 0.55, lineGap: 1 });
    y += 10;
    doc.text(COMPANY.city, left, y);
    y += 10;
    doc.text(`Tel  ${COMPANY.phone}`, left, y);
    y += 10;
    doc.text(`e-mail  ${COMPANY.email}`, left, y);
    y += 10;
    doc.text(`web  ${COMPANY.web}`, left, y);
    y += 14;

    drawBox(doc, left, y, 90, 28, undefined, data.documentNumber, 14);
    y += 34;

    const colW = contentW / 9;
    const metaLabels = [
      data.documentTypeLabel,
      "Fecha",
      "Cliente",
      "Telefono(s)",
      "Vendedor",
      "Transportista",
      "CIF Transport",
      "Vehic.Transp.",
      "Almacen",
    ];
    const metaValues = [
      data.documentNumber,
      formatDate(data.issueDate),
      profile.clientCode,
      profile.phone,
      data.sellerName,
      "",
      "",
      "",
      COMPANY.warehouse,
    ];

    metaLabels.forEach((label, i) => {
      const x = left + i * colW;
      drawBox(doc, x, y, colW - 2, 32, label, metaValues[i], 7);
    });
    y += 40;

    doc.fontSize(9).font("Helvetica-Bold").text(data.client.name.toUpperCase(), left, y);
    doc.font("Helvetica").fontSize(8);
    y += 12;
    if (profile.documentNumber) {
      const docLine = profile.documentLabel
        ? `${profile.documentLabel} ${profile.documentNumber}`
        : profile.documentNumber;
      doc.text(docLine.toUpperCase(), left, y);
      y += 10;
    }
    if (profile.address) {
      doc.text(profile.address.toUpperCase(), left, y, { width: contentW * 0.6 });
      y += 10;
    }
    if (profile.city) {
      doc.text(profile.city.toUpperCase(), left, y);
      y += 10;
    }
    doc.text(profile.province.toUpperCase(), left, y);
    y += 10;
    if (data.department) {
      doc.font("Helvetica-Bold").text(data.department.toUpperCase(), left, y);
      y += 12;
    }

    y += 6;
    doc.fontSize(11).font("Helvetica-Bold").text(data.title, left, y, {
      align: "center",
      width: contentW,
    });
    y += 20;

    const tableTop = y;
    const cols = [
      { label: "Articulo", x: left, w: 72 },
      { label: "Descripcion del Articulo", x: left + 72, w: 138 },
      { label: "Marca/Fabr", x: left + 210, w: 45 },
      { label: "TC-LC-Lote", x: left + 255, w: 45 },
      { label: "Cantidad", x: left + 300, w: 45 },
      { label: "UM", x: left + 345, w: 25 },
      { label: "Precio", x: left + 370, w: 45 },
      { label: "% Dto", x: left + 415, w: 35 },
      { label: "Importe", x: left + 450, w: contentW - 450 },
    ];

    doc.rect(left, tableTop, contentW, 16).fillAndStroke("#e8e8e8", "#000000");
    doc.fillColor("#000000").fontSize(6).font("Helvetica-Bold");
    cols.forEach((c) => {
      doc.text(c.label, c.x + 2, tableTop + 4, { width: c.w - 4, align: "center" });
    });

    let rowY = tableTop + 16;
    doc.font("Helvetica").fontSize(7);
    for (const item of data.lineItems) {
      if (item.isSectionHeader) {
        const rowH = 18;
        doc.rect(left, rowY, contentW, rowH).fillAndStroke("#f0f0f0", "#cccccc");
        doc
          .fillColor("#000000")
          .fontSize(7)
          .font("Helvetica-Bold")
          .text(item.description, left + 4, rowY + 5, {
            width: contentW - 8,
            height: rowH - 6,
            lineBreak: false,
            ellipsis: true,
          });
        doc.font("Helvetica").fontSize(7);
        rowY += rowH;
        continue;
      }

      const rowH = item.subNote ? 28 : 20;
      doc.rect(left, rowY, contentW, rowH).stroke("#cccccc");
      const brand = item.brand ?? item.sku.split("-")[1] ?? "";
      doc.fontSize(6).text(item.sku, cols[0].x + 2, rowY + 6, {
        width: cols[0].w - 4,
        height: rowH - 8,
        lineGap: 0,
        lineBreak: false,
        ellipsis: true,
      });
      doc.fontSize(7).text(item.description, cols[1].x + 2, rowY + 5, {
        width: cols[1].w - 4,
        height: rowH - 6,
        lineBreak: false,
        ellipsis: true,
      });
      doc.text(brand, cols[2].x + 2, rowY + 5, { width: cols[2].w - 4, align: "center" });
      doc.text("0/0", cols[3].x + 2, rowY + 5, { width: cols[3].w - 4, align: "center" });
      doc.text(String(item.quantity), cols[4].x + 2, rowY + 5, { width: cols[4].w - 4, align: "right" });
      doc.text(item.unit, cols[5].x + 2, rowY + 5, { width: cols[5].w - 4, align: "center" });
      doc.text(item.unitPrice.toFixed(3), cols[6].x + 2, rowY + 5, { width: cols[6].w - 4, align: "right" });
      doc.text(`${item.discountPct.toFixed(2)}%`, cols[7].x + 2, rowY + 5, { width: cols[7].w - 4, align: "right" });
      doc.text(formatMoney(item.lineTotal), cols[8].x + 2, rowY + 5, { width: cols[8].w - 4, align: "right" });
      if (item.subNote) {
        doc.fontSize(6).font("Helvetica-Oblique").text(item.subNote, cols[1].x + 2, rowY + 16, {
          width: cols[1].w - 4,
        });
        doc.fontSize(7).font("Helvetica");
      }
      rowY += rowH;
    }

    const minEmptyRows = 2;
    const targetTableBottom = Math.min(tableTop + 16 + 18 * minEmptyRows, maxTableBottom);
    while (rowY < targetTableBottom) {
      doc.rect(left, rowY, contentW, 18).stroke("#eeeeee");
      rowY += 18;
    }

    if (data.originNote && rowY + 14 <= footerTop) {
      doc.fontSize(7).font("Helvetica-Oblique").text(data.originNote, left, rowY + 6, {
        width: contentW,
        height: 12,
        lineBreak: false,
        ellipsis: true,
      });
    }

    doc.fontSize(8).font("Helvetica");
    doc.text(`Cobrado Efectivo : ${formatMoney(data.paymentCash ?? 0)}`, left, footerTop, {
      lineBreak: false,
    });
    const transferRef = data.paymentTransferRef ?? data.documentNumber;
    doc.text(
      `Transf.${transferRef}  ${formatMoney(data.paymentTransfer ?? 0)}`,
      left,
      footerTop + 12,
      { lineBreak: false },
    );
    doc.fontSize(10).font("Helvetica-Bold").text("ORIGINAL", left, footerTop + 28, {
      lineBreak: false,
    });

    const totX = right - 180;
    const totY = footerTop;
    const totRows: [string, string][] = [
      ["Bruto", formatMoney(data.bruto)],
      ["Descuento", formatMoney(data.discountTotal)],
      ["Bases", formatMoney(data.subtotal)],
      [`Cuota IVA  ${data.taxRate.toFixed(0)}%`, formatMoney(data.taxAmount)],
      ["Ret.IRPF", ""],
      ["Ret.Garantia", ""],
    ];
    totRows.forEach(([label, val], i) => {
      doc.fontSize(8).font("Helvetica").text(label, totX, totY + i * 14, { width: 80, lineBreak: false });
      doc.text(val, totX + 85, totY + i * 14, { width: 90, align: "right", lineBreak: false });
    });
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("Total", totX, totY + 90, { width: 80, lineBreak: false });
    doc.text(formatMoney(data.total), totX + 85, totY + 90, { width: 90, align: "right", lineBreak: false });
    doc.fontSize(8).font("Helvetica").text("Recibi y Conforme", totX, totY + 115, {
      width: 175,
      align: "center",
      lineBreak: false,
    });
    doc.moveTo(totX, totY + 130).lineTo(totX + 175, totY + 130).stroke();

    doc.fontSize(5).font("Helvetica").text(RGPD_TEXT, left, rgpdY, {
      width: contentW,
      height: rgpdHeight + 2,
      align: "justify",
      lineGap: 1,
    });

    doc.fontSize(7).font("Helvetica");
    doc.text("Material retirado por", left, pageFooterY, { lineBreak: false });
    if (data.footerBarcode) {
      doc.fontSize(6).text(data.footerBarcode, left, pageFooterY + 10, { lineBreak: false });
    }
    doc.fontSize(7).text("Página: 1", right - 60, pageFooterY, { lineBreak: false });

    doc.end();
  });
}
