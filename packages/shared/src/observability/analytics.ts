/**
 * Product analytics event definitions (A-103).
 *
 * Defines the event schema for tracking user behavior and product KPIs.
 * Events are emitted via the analytics service and can be routed to
 * any analytics backend (PostHog, Amplitude, internal DB).
 *
 * Privacy: all events are workspace-scoped, no PII in event properties.
 * User IDs are pseudonymized hashes, not raw emails.
 */

export type AnalyticsEventName =
  | 'workspace.created'
  | 'source.connected'
  | 'source.disconnected'
  | 'source.sync_started'
  | 'source.sync_completed'
  | 'document.indexed'
  | 'document.deleted'
  | 'editor.session_started'
  | 'editor.session_ended'
  | 'completion.requested'
  | 'completion.accepted'
  | 'completion.rejected'
  | 'completion.timeout'
  | 'completion.error'
  | 'provider.configured'
  | 'provider.health_check'
  | 'auth.login'
  | 'auth.logout'
  | 'beta.onboarded'
  | 'beta.feedback_submitted';

export interface AnalyticsEvent {
  /** Event name from the defined taxonomy */
  name: AnalyticsEventName;
  /** Pseudonymized workspace identifier */
  workspaceId: string;
  /** Pseudonymized user identifier (optional for system events) */
  userId?: string;
  /** Event-specific properties */
  properties: Record<string, string | number | boolean | null>;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Create an analytics event with automatic timestamp.
 */
export function createAnalyticsEvent(
  name: AnalyticsEventName,
  workspaceId: string,
  properties: Record<string, string | number | boolean | null> = {},
  userId?: string,
): AnalyticsEvent {
  return {
    name,
    workspaceId,
    userId,
    properties,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Product KPI definitions for the beta dashboard (A-104).
 *
 * These are the metrics that matter for go/no-go decisions.
 */
export const BETA_KPIS = {
  /** Weekly active users (at least 1 completion) */
  WAU: {
    name: 'Weekly Active Users',
    query: 'COUNT(DISTINCT userId) WHERE completion.requested in last 7 days',
    target: '>= 10',
  },
  /** Completion acceptance rate */
  acceptanceRate: {
    name: 'Completion Acceptance Rate',
    query: 'completion.accepted / completion.requested * 100',
    target: '>= 30%',
  },
  /** Evidence grounding rate */
  groundingRate: {
    name: 'Evidence Grounding Rate',
    query: 'completions with isGrounded=true / total completions * 100',
    target: '>= 50%',
  },
  /** P95 completion latency */
  p95Latency: {
    name: 'P95 Completion Latency',
    query: 'PERCENTILE(95, completion_latency_seconds)',
    target: '<= 3s',
  },
  /** Documents indexed per workspace */
  docsPerWorkspace: {
    name: 'Avg Documents per Workspace',
    query: 'AVG(documents per workspace)',
    target: '>= 5',
  },
  /** Error rate */
  errorRate: {
    name: 'Error Rate',
    query: 'completion.error / completion.requested * 100',
    target: '<= 5%',
  },
} as const;
