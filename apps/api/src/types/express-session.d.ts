import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
    workspaceId?: string;
    authenticatedAt?: number;
  }
}
