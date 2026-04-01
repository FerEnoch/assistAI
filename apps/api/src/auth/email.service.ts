import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendMagicLinkOptions {
  to: string;
  magicLinkUrl: string;
}

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromAddress = process.env.EMAIL_FROM ?? 'AssistAI <noreply@assistai.app>';
  }

  async sendMagicLink({ to, magicLinkUrl }: SendMagicLinkOptions): Promise<void> {
    await this.resend.emails.send({
      from: this.fromAddress,
      to,
      subject: 'Iniciá sesión en AssistAI',
      html: this.buildMagicLinkHtml(magicLinkUrl),
    });
  }

  private buildMagicLinkHtml(url: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
  <h2 style="color: #1a1a2e; margin-bottom: 16px;">Iniciá sesión en AssistAI</h2>
  <p style="color: #4a4a4a; line-height: 1.6;">
    Hacé clic en el siguiente enlace para acceder a tu cuenta.
    Este enlace expira en 15 minutos.
  </p>
  <p style="margin: 32px 0;">
    <a href="${url}"
       style="background-color: #2563eb; color: white; padding: 12px 32px;
              border-radius: 6px; text-decoration: none; font-weight: 600;
              display: inline-block;">
      Iniciar sesión
    </a>
  </p>
  <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
    Si no solicitaste este enlace, podés ignorar este correo de forma segura.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
  <p style="color: #9ca3af; font-size: 12px;">AssistAI — Asistente de escritura con IA para profesionales del derecho</p>
</body>
</html>`.trim();
  }
}
