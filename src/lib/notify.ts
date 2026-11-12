// Email to the owner through Cloudflare Email Routing's send_email binding (free). When the binding is not configured yet, the message is
// written to the Worker log instead, so the health job still runs and nothing breaks before the owner finishes the one-time setup.
import type { Env } from '../types/env.js';

export type MailResult = 'sent' | 'skipped' | 'failed';

export function buildRawMessage(from: string, to: string, subject: string, body: string, now = new Date()): string {
  const id = `${now.getTime().toString(36)}.${Math.random().toString(36).slice(2, 10)}@${from.split('@')[1] ?? 'localhost'}`;
  const safeSubject = subject.replace(/[\r\n]+/g, ' ').slice(0, 200);
  return [
    `From: Aex Terminal <${from}>`,
    `To: ${to}`,
    `Subject: ${safeSubject}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${id}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body.replace(/\r?\n/g, '\r\n'),
  ].join('\r\n');
}

export async function sendMail(env: Env, subject: string, body: string): Promise<MailResult> {
  const binding = env.ALERT_EMAIL;
  const to = env.ALERT_TO ?? 'CEO@aexmeridian.com';
  const from = env.ALERT_FROM ?? 'alerts@aexmeridian.com';
  if (!binding) {
    console.log(`[alert, not sent: no ALERT_EMAIL binding] ${subject}\n${body}`);
    return 'skipped';
  }
  try {
    const { EmailMessage } = await import('cloudflare:email');
    await binding.send(new EmailMessage(from, to, buildRawMessage(from, to, subject, body)));
    return 'sent';
  } catch (err) {
    console.error('Alert email failed:', err instanceof Error ? err.message : String(err));
    return 'failed';
  }
}
