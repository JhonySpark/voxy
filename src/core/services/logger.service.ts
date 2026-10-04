import { Logtail } from '@logtail/browser';

/**
 * Serviço de observabilidade e logging estruturado para o frontend (Better Stack / Logtail).
 * Suporta Electron e Web, com fallback gracioso para console e proteção do Free Tier (1GB/mês)
 * através de deduplicação e sanitização de dados sensíveis.
 */
class FrontendLoggerService {
  private logtail: Logtail | null = null;
  private readonly isEnabled: boolean = false;
  private readonly recentLogs = new Map<string, number>();

  constructor() {
    const token = import.meta.env.VITE_BETTER_STACK_SOURCE_TOKEN;
    let endpoint = (
      import.meta.env.VITE_BETTER_STACK_ENDPOINT ||
      import.meta.env.VITE_BETTER_STACK_INGESTING_HOST ||
      ''
    ).trim();

    if (endpoint && !endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }

    if (token && typeof token === 'string' && token.trim().length > 0) {
      try {
        this.logtail = new Logtail(token.trim(), endpoint ? { endpoint } : undefined);
        this.isEnabled = true;
        console.log(
          `[BetterStack] Telemetria ATIVADA no Frontend. Destino: ${endpoint || 'https://in.logs.betterstack.com (Padrão US)'}`,
        );
      } catch (err) {
        console.warn('[BetterStack] Failed to initialize frontend logger:', err);
      }
    } else {
      console.warn(
        '[BetterStack] Telemetria DESATIVADA no Frontend: VITE_BETTER_STACK_SOURCE_TOKEN não configurado no frontend/.env.',
      );
    }
  }

  private isDuplicate(key: string, windowMs = 4000): boolean {
    const now = Date.now();
    const lastTime = this.recentLogs.get(key);
    if (lastTime && now - lastTime < windowMs) {
      return true;
    }
    this.recentLogs.set(key, now);

    // Limpeza de cache se passar de 100 itens
    if (this.recentLogs.size > 100) {
      for (const [k, time] of this.recentLogs.entries()) {
        if (now - time > 10000) {
          this.recentLogs.delete(k);
        }
      }
    }
    return false;
  }

  private sanitize(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((item) => this.sanitize(item));

    const sensitiveFields = ['password', 'token', 'secret', 'jwt', 'authorization', 'cookie'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private getAmbientContext(): Record<string, unknown> {
    let currentUser: unknown = undefined;
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        currentUser = {
          id: parsed.id,
          username: parsed.username,
        };
      }
    } catch {
      // Ignora falha de parse do localStorage
    }

    return {
      environment: import.meta.env.MODE || 'production',
      platform: typeof window !== 'undefined' && (window as unknown as { electronAPI?: unknown }).electronAPI ? 'electron' : 'web',
      route: typeof window !== 'undefined' ? window.location.hash || window.location.pathname : '',
      user: currentUser,
    };
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[Voxy] ${message}`, context || '');
    if (!this.isEnabled || !this.logtail) return;

    const key = `INFO:${message}`;
    if (this.isDuplicate(key)) return;

    this.logtail.info(message, {
      ...this.getAmbientContext(),
      ...(context ? (this.sanitize(context) as Record<string, unknown>) : {}),
    });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[Voxy] ${message}`, context || '');
    if (!this.isEnabled || !this.logtail) return;

    const key = `WARN:${message}`;
    if (this.isDuplicate(key)) return;

    this.logtail.warn(message, {
      ...this.getAmbientContext(),
      ...(context ? (this.sanitize(context) as Record<string, unknown>) : {}),
    });
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    console.error(`[Voxy] ${message}`, error, context || '');
    if (!this.isEnabled || !this.logtail) return;

    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            errorMessage: error.message,
            stack: error.stack,
          }
        : { rawError: String(error) };

    const key = `ERROR:${message}:${(error as Error)?.message || ''}`;
    if (this.isDuplicate(key)) return;

    this.logtail.error(message, {
      ...this.getAmbientContext(),
      ...errorDetails,
      ...(context ? (this.sanitize(context) as Record<string, unknown>) : {}),
    });
  }

  logEvent(eventName: string, data?: Record<string, unknown>): void {
    if (!this.isEnabled || !this.logtail) {
      console.log(`[Event: ${eventName}]`, data || '');
      return;
    }

    this.logtail.info(`[Business Event] ${eventName}`, {
      ...this.getAmbientContext(),
      event: eventName,
      ...(data ? (this.sanitize(data) as Record<string, unknown>) : {}),
    });
  }

  async flush(): Promise<void> {
    if (this.logtail) {
      await this.logtail.flush();
    }
  }
}

export const logger = new FrontendLoggerService();
