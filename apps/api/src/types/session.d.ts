import 'express-session';

/**
 * Augment express-session's SessionData with AssistAI-specific fields.
 */
declare module 'express-session' {
  interface SessionData {
    /** Authenticated user ID (uuid) */
    userId: string;
    /** User email */
    email: string;
    /** Default workspace ID */
    workspaceId: string;
    /** Timestamp of last authentication (for RecentAuthGuard) */
    authenticatedAt: number;
  }
}
