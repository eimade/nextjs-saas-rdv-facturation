import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Port d'envoi d'email : la couche service ne dépend que de cette signature.
 * Deux adaptateurs, choisis par MAIL_TRANSPORT (aucun compte externe requis) :
 *  - "smtp"    : SMTP local (Mailpit dans docker compose, interface web http://localhost:18025)
 *  - "console" : bouchon qui journalise le message et le conserve en mémoire (défaut hors Docker)
 */
export type SendMail = (message: MailMessage) => Promise<void>;

const FROM = () => process.env.MAIL_FROM ?? "Kalendo <no-reply@kalendo.local>";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 11025),
      secure: false,
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    });
  }
  return transporter;
}

export const smtpMailer: SendMail = async ({ to, subject, text }) => {
  await getTransporter().sendMail({ from: FROM(), to, subject, text });
};

/** Bouchon : boîte d'envoi en mémoire (consultable dans les tests) + trace console. */
export const consoleOutbox: MailMessage[] = [];

export const consoleMailer: SendMail = async (message) => {
  consoleOutbox.push(message);
  console.info(`[mail:simulé] à=${message.to} objet="${message.subject}"`);
};

export function resolveMailer(transport = process.env.MAIL_TRANSPORT): SendMail {
  return transport === "smtp" ? smtpMailer : consoleMailer;
}

/** Adaptateur actif selon la configuration. */
export const sendMail: SendMail = (message) => resolveMailer()(message);
