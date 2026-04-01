import { Injectable, Logger } from '@nestjs/common';
import { createAnalyticsEvent } from '@assistai/shared';
import type { AnalyticsEventName, AnalyticsEvent } from '@assistai/shared';

/**
 * Product analytics service (A-103).
 *
 * Captures product events for KPI tracking and beta evaluation.
 * In MVP, events are logged as structured JSON — can be routed to
 * PostHog, Amplitude, or a data warehouse in production.
 *
 * Privacy: no PII in event properties. User/workspace IDs only.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger('Analytics');

  /**
   * Track a product analytics event.
   *
   * Events are logged as structured JSON and can be piped to any
   * analytics backend via log aggregation (e.g. Loki → dashboard).
   */
  track(
    name: AnalyticsEventName,
    workspaceId: string,
    properties: Record<string, string | number | boolean | null> = {},
    userId?: string,
  ): void {
    const event = createAnalyticsEvent(name, workspaceId, properties, userId);

    // Structured log output — picked up by log aggregation pipeline
    this.logger.log({
      msg: `[Event] ${name}`,
      event: this.sanitizeEvent(event),
    });
  }

  /**
   * Sanitize event for logging — strip any accidentally included PII.
   */
  private sanitizeEvent(event: AnalyticsEvent): AnalyticsEvent {
    const sanitized = { ...event };

    // Remove any property that looks like an email or token
    const props = { ...sanitized.properties };
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'string') {
        // Redact anything that looks like an email
        if (value.includes('@') && value.includes('.')) {
          props[key] = '[REDACTED_EMAIL]';
        }
        // Redact anything that looks like a token/key
        if (typeof value === 'string' && value.length > 40 && /^[a-zA-Z0-9_-]+$/.test(value)) {
          props[key] = '[REDACTED_TOKEN]';
        }
      }
    }

    sanitized.properties = props;
    return sanitized;
  }
}
