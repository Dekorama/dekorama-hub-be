import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail = "admin@dekoramagroup.com";
  private readonly fromName = "Dekorama Hub";
  private readonly brevoApiKey = process.env.BREVO_API_KEY || "";

  constructor() {
    if (!this.brevoApiKey) {
      this.logger.warn("BREVO_API_KEY not configured - emails will be logged to console");
    }
  }

  async sendInvitation(to: string, inviteLink: string, organizerName: string): Promise<void> {
    this.logger.log(`[EMAIL] Sending invitation to ${to}`);
    this.logger.log(`[EMAIL] From: ${organizerName}`);
    this.logger.log(`[EMAIL] Link: ${inviteLink}`);

    if (!this.brevoApiKey) {
      this.logger.log("[EMAIL] No API key - email not sent (dev mode)");
      return;
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": this.brevoApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: to }],
          subject: `${organizerName} te ha invitado a Dekorama Hub`,
          htmlContent: this.getInvitationTemplate(inviteLink, organizerName),
        }),
      });

      if (!response.ok) {
        throw new Error(`Brevo API error: ${response.status}`);
      }

      this.logger.log(`[EMAIL] Successfully sent to ${to}`);
    } catch (error) {
      this.logger.error(`[EMAIL] Failed to send to ${to}:`, error);
      throw error;
    }
  }

  async sendAdminInvitation(to: string, inviteLink: string, senderName: string): Promise<void> {
    this.logger.log(`[EMAIL] Sending admin invitation to ${to}`);
    this.logger.log(`[EMAIL] Sender: ${senderName}`);
    this.logger.log(`[EMAIL] Link: ${inviteLink}`);

    if (!this.brevoApiKey) {
      this.logger.log("[EMAIL] No API key - email not sent (dev mode)");
      return;
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": this.brevoApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: to }],
          subject: "Invitación de administrador — Dekorama Hub",
          htmlContent: this.getAdminInvitationTemplate(inviteLink, senderName),
        }),
      });

      if (!response.ok) {
        throw new Error(`Brevo API error: ${response.status}`);
      }

      this.logger.log(`[EMAIL] Successfully sent admin invite to ${to}`);
    } catch (error) {
      this.logger.error(`[EMAIL] Failed to send admin invite to ${to}:`, error);
      throw error;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private baseEmailLayout(options: {
    preheader: string;
    title: string;
    bodyHtml: string;
    ctaLabel: string;
    ctaHref: string;
  }): string {
    const { preheader, title, bodyHtml, ctaLabel, ctaHref } = options;
    const safeHref = this.escapeHtml(ctaHref);
    const safeTitle = this.escapeHtml(title);
    const safeCta = this.escapeHtml(ctaLabel);
    const safePreheader = this.escapeHtml(preheader);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #111111;">
              <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#111111;font-weight:700;">Dekorama Hub</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 16px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:#111111;">${safeTitle}</h1>
              ${bodyHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                <tr>
                  <td style="background:#111111;">
                    <a href="${safeHref}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;letter-spacing:0.04em;text-decoration:none;color:#ffffff;">${safeCta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#666666;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <a href="${safeHref}" style="color:#111111;word-break:break-all;">${safeHref}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e5e5e5;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#888888;">
                Este enlace caduca en 7 días. Si no esperabas este correo, puedes ignorarlo.
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#aaaaaa;">
                © ${new Date().getFullYear()} Dekorama Hub
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getInvitationTemplate(inviteLink: string, organizerName: string): string {
    const name = this.escapeHtml(organizerName);
    return this.baseEmailLayout({
      preheader: `${organizerName} te invita a unirte a su comunidad en Dekorama Hub.`,
      title: "Invitación a la comunidad",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#333333;">
          <strong style="color:#111111;">${name}</strong> te ha invitado a unirte a su comunidad en Dekorama Hub.
        </p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#333333;">
          Crea tu cuenta para colaborar en proyectos de reconstrucción con profesionales verificados.
        </p>
      `,
      ctaLabel: "Aceptar invitación",
      ctaHref: inviteLink,
    });
  }

  private getAdminInvitationTemplate(inviteLink: string, senderName: string): string {
    const name = this.escapeHtml(senderName);
    return this.baseEmailLayout({
      preheader: `${senderName} te invita como administrador de Dekorama Hub.`,
      title: "Invitación de administrador",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#333333;">
          <strong style="color:#111111;">${name}</strong> te invita a unirte como administrador de Dekorama Hub.
        </p>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#333333;">
          Con esta cuenta podrás gestionar usuarios, productos e invitaciones del equipo.
        </p>
      `,
      ctaLabel: "Crear cuenta de administrador",
      ctaHref: inviteLink,
    });
  }

  async sendProforma(
    to: string,
    clientName: string,
    link: string,
    pdfBuffer: Buffer,
  ): Promise<void> {
    this.logger.log(`[EMAIL] Sending proforma to ${to}`);
    await this.sendWithAttachment(
      to,
      "Tu proforma Dekorama está lista",
      `<p>Hola ${clientName},</p><p>Tu proforma está lista. <a href="${link}">Ver en Dekorama</a></p>`,
      pdfBuffer,
      "proforma.pdf",
    );
  }

  async sendSupplierOrder(
    to: string | string[],
    supplierName: string,
    orderNumber: string,
    pdfBuffer: Buffer,
  ): Promise<boolean> {
    const recipients = (Array.isArray(to) ? to : [to])
      .map((e) => e.trim())
      .filter(Boolean);
    this.logger.log(`[EMAIL] Sending PO ${orderNumber} to ${recipients.join(", ")}`);
    return this.sendWithAttachment(
      recipients,
      `Pedido ${orderNumber} - Dekorama`,
      `<p>Hola ${supplierName},</p><p>Adjuntamos pedido ${orderNumber}.</p>`,
      pdfBuffer,
      `${orderNumber}.pdf`,
    );
  }

  private async sendWithAttachment(
    to: string | string[],
    subject: string,
    htmlContent: string,
    pdfBuffer: Buffer,
    filename: string,
  ): Promise<boolean> {
    if (!this.brevoApiKey) {
      this.logger.log("[EMAIL] No API key - email not sent (dev mode)");
      return false;
    }

    const recipients = (Array.isArray(to) ? to : [to])
      .map((e) => e.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    if (recipients.length === 0) {
      this.logger.warn("[EMAIL] No recipients provided");
      return false;
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": this.brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromEmail },
        to: recipients,
        subject,
        htmlContent,
        attachment: [{ content: pdfBuffer.toString("base64"), name: filename }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo API error: ${response.status}`);
    }

    return true;
  }
}
