import type { Logger } from 'pino';

/** An image sent with the email and shown in it via `cid:{contentId}`. */
export type InlineImage = {
  contentId: string;
  filename: string;
  /** Base64 file content. */
  content: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  inlineImages?: InlineImage[];
};

/** Sends transactional email. Credentials stay on the server. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Resend's REST API (no SDK); `from` must use the verified domain. */
export class ResendEmailSender implements EmailSender {
  constructor(
    private apiKey: string,
    private from: string,
    private logger?: Pick<Logger, 'error'>,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.inlineImages?.length
          ? {
              attachments: message.inlineImages.map((image) => ({
                filename: image.filename,
                content: image.content,
                content_id: image.contentId,
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      // Never log the message itself: it contains a one-time code.
      this.logger?.error(
        { status: response.status, subject: message.subject },
        'Email delivery failed',
      );
      throw new Error(`Email delivery failed (${response.status})`);
    }
  }
}

/** Keeps sent messages in memory; used by tests to read one-time codes. */
export class MemoryMailbox implements EmailSender {
  readonly messages: EmailMessage[] = [];
  private waiting: Array<() => void> = [];

  async send(message: EmailMessage) {
    this.messages.push(message);
    for (const wake of this.waiting.splice(0)) wake();
  }

  /**
   * The newest 6-digit code sent to `to`, waiting briefly for it. With
   * `after`, waits for a message newer than the first `after` ones (codes
   * sent in the background arrive after the response).
   */
  async codeFor(to: string, after = 0, timeoutMs = 10_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const sent = this.messages.filter((m) => m.to === to);
      const latest = sent.length > after ? sent.at(-1) : undefined;
      const code = latest?.text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
      if (Date.now() > deadline) throw new Error(`No code sent to ${to}`);
      await new Promise<void>((resolve) => {
        this.waiting.push(resolve);
        setTimeout(resolve, 200);
      });
    }
  }

  countFor(to: string) {
    return this.messages.filter((m) => m.to === to).length;
  }
}
