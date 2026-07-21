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

    // ponytail: Using native fetch (Node 18+) instead of Brevo SDK - simpler, no deps
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

  private getInvitationTemplate(inviteLink: string, organizerName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6f00 0%, #e65100 100%); 
                      color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #ff6f00; color: white; 
                     padding: 12px 30px; text-decoration: none; border-radius: 5px; 
                     font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏠 Dekorama Hub</h1>
            </div>
            <div class="content">
              <h2>¡Hola!</h2>
              <p><strong>${organizerName}</strong> te ha invitado a unirte a su comunidad en Dekorama Hub.</p>
              <p>Dekorama Hub es la plataforma que conecta a comunidades afectadas por desastres con profesionales verificados para proyectos de reconstrucción.</p>
              <p>Haz clic en el botón de abajo para crear tu cuenta y unirte a la comunidad:</p>
              <p style="text-align: center;">
                <a href="${inviteLink}" class="button">Aceptar Invitación</a>
              </p>
              <p style="color: #666; font-size: 14px;">
                Este enlace expirará en 7 días. Si no solicitaste esta invitación, puedes ignorar este correo.
              </p>
            </div>
            <div class="footer">
              <p>© 2026 Dekorama Hub. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;
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
          subject: `Invitación como Administrador de Dekorama Hub`,
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

  private getAdminInvitationTemplate(inviteLink: string, senderName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body>
          <p><strong>${senderName}</strong> te invita como administrador de Dekorama Hub.</p>
          <p><a href="${inviteLink}">Aceptar invitación</a></p>
        </body>
      </html>
    `;
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
