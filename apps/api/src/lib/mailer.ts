import type { FastifyBaseLogger } from 'fastify';

/**
 * Outgoing email. The console implementation is for development: it logs the reset link
 * instead of sending it. A real provider (Resend, Postmark, SES) needs an account and API key,
 * see PROGRESS.md "Needs Jay".
 */
export interface Mailer {
  sendPasswordReset(to: string, link: string): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  constructor(
    private readonly log: FastifyBaseLogger,
    private readonly production: boolean,
  ) {}

  async sendPasswordReset(to: string, link: string): Promise<void> {
    if (this.production) {
      // Never write reset tokens to production logs.
      this.log.warn({ to }, 'Password reset requested but no email provider is configured');
      return;
    }
    this.log.info({ to, link }, 'Password reset link (development mailer)');
  }
}
