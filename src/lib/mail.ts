import nodemailer from "nodemailer";

export const mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/** Sends a mail through the SMTP server configured in .env.local (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM). */
export async function sendMail(o: {
  to: string; subject: string; text: string; attachments?: { filename: string; content: Buffer }[];
}) {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, ...o });
}
