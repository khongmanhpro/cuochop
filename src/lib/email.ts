import { Resend } from "resend";

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  text?: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey || !from) {
    throw new Error("Email is not configured.");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}
