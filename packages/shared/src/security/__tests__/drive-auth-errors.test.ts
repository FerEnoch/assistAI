import { describe, it, expect } from 'vitest';
import { isDriveAuthFailure } from '../drive-auth-errors';

describe('isDriveAuthFailure', () => {
  it('returns false for null/undefined', () => {
    expect(isDriveAuthFailure(null)).toBe(false);
    expect(isDriveAuthFailure(undefined)).toBe(false);
  });

  it('returns true for 401 status code', () => {
    expect(isDriveAuthFailure({ code: 401, message: 'Unauthorized' })).toBe(true);
    expect(isDriveAuthFailure({ status: 401, message: '' })).toBe(true);
    expect(isDriveAuthFailure({ response: { status: 401 }, message: '' })).toBe(true);
  });

  it('returns true for invalid_grant message', () => {
    const err = new Error('invalid_grant: Token has been revoked');
    expect(isDriveAuthFailure(err)).toBe(true);
  });

  it('returns true for token expired/revoked messages', () => {
    expect(isDriveAuthFailure(new Error('Token has been expired or revoked'))).toBe(true);
    expect(isDriveAuthFailure(new Error('Token has been revoked'))).toBe(true);
    expect(isDriveAuthFailure(new Error('Failed to refresh access token'))).toBe(true);
  });

  it('returns true for insufficient_scope', () => {
    expect(isDriveAuthFailure(new Error('insufficient_scope: need drive.readonly'))).toBe(true);
  });

  it('returns false for a bare 403 without token-level signals', () => {
    // A generic 403 on a single file is NOT an auth failure
    const err = { code: 403, message: 'The user does not have sufficient permissions for this file' };
    expect(isDriveAuthFailure(err)).toBe(false);
  });

  it('returns false for a 404', () => {
    expect(isDriveAuthFailure({ code: 404, message: 'File not found' })).toBe(false);
  });

  it('returns false for a random processing error', () => {
    expect(isDriveAuthFailure(new Error('ECONNRESET'))).toBe(false);
    expect(isDriveAuthFailure(new Error('timeout of 30000ms exceeded'))).toBe(false);
  });

  it('returns true for Google API error array with authError reason', () => {
    const err = {
      code: 403,
      message: 'some error',
      errors: [{ reason: 'authError', message: 'foo' }],
    };
    expect(isDriveAuthFailure(err)).toBe(true);
  });

  it('returns true for insufficientPermissions reason in errors array', () => {
    const err = {
      code: 403,
      message: 'some error',
      errors: [{ reason: 'insufficientPermissions', message: 'foo' }],
    };
    expect(isDriveAuthFailure(err)).toBe(true);
  });

  it('returns false for forbidden reason without token-level pattern in message', () => {
    // A 403 with reason=forbidden but no token-level keywords → per-file ACL
    const err = {
      code: 403,
      message: 'user cannot access this resource',
      errors: [{ reason: 'forbidden', message: 'user cannot access' }],
    };
    expect(isDriveAuthFailure(err)).toBe(false);
  });
});
