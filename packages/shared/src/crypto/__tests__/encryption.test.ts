import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptWithVersion, rotateEncryption } from '../encryption';
import { randomBytes } from 'node:crypto';

const TEST_KEY = randomBytes(32).toString('hex'); // 64 hex chars

describe('AES-256-GCM encryption', () => {
  it('should encrypt and decrypt a plaintext round-trip', () => {
    const plaintext = 'ya29.a0ARrdaM8some_google_access_token_here';
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for the same plaintext (random IV)', () => {
    const plaintext = 'same-input-twice';
    const a = encrypt(plaintext, TEST_KEY);
    const b = encrypt(plaintext, TEST_KEY);

    expect(a).not.toBe(b);
    // But both should decrypt to the same value
    expect(decrypt(a, TEST_KEY)).toBe(plaintext);
    expect(decrypt(b, TEST_KEY)).toBe(plaintext);
  });

  it('should store in iv:authTag:ciphertext hex format', () => {
    const encrypted = encrypt('test', TEST_KEY);
    const parts = encrypted.split(':');

    expect(parts).toHaveLength(3);
    // IV = 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32);
    // AuthTag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext = some hex chars
    expect(parts[2].length).toBeGreaterThan(0);
    // All parts should be hex
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/);
    }
  });

  it('should throw on tampered auth tag', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    const parts = encrypted.split(':');
    // Flip a character in the auth tag
    const tampered = `${parts[0]}:${'00'.repeat(16)}:${parts[2]}`;

    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${'ff'.repeat(parts[2].length / 2)}`;

    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it('should throw on wrong key', () => {
    const encrypted = encrypt('secret', TEST_KEY);
    const wrongKey = randomBytes(32).toString('hex');

    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('should throw on invalid key length', () => {
    expect(() => encrypt('test', 'short-key')).toThrow('64 hex characters');
  });

  it('should throw on invalid stored format', () => {
    expect(() => decrypt('not-valid-format', TEST_KEY)).toThrow('iv:authTag:ciphertext');
  });

  it('should handle empty plaintext', () => {
    const encrypted = encrypt('', TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);

    expect(decrypted).toBe('');
  });

  it('should handle unicode plaintext', () => {
    const plaintext = 'Cláusula de confidencialidad § 2.5 — derechos reservados ©';
    const encrypted = encrypt(plaintext, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);

    expect(decrypted).toBe(plaintext);
  });

  it('should never store plaintext google token patterns in ciphertext', () => {
    const token = '1//0eBd_fake_refresh_token_here';
    const encrypted = encrypt(token, TEST_KEY);

    // The encrypted value should NEVER contain the plaintext token prefix
    expect(encrypted).not.toContain('1//');
    expect(encrypted).not.toContain('ya29.');
  });
});

describe('Versioned encryption (A-090 key rotation)', () => {
  it('should encrypt with version metadata', () => {
    const result = encryptWithVersion('secret', TEST_KEY, 1);

    expect(result.keyVersion).toBe(1);
    expect(result.encrypted.split(':')).toHaveLength(3);
    expect(decrypt(result.encrypted, TEST_KEY)).toBe('secret');
  });

  it('should rotate encryption from old key to new key', () => {
    const oldKey = TEST_KEY;
    const newKey = randomBytes(32).toString('hex');

    // Encrypt with old key
    const original = encrypt('my-refresh-token', oldKey);

    // Rotate to new key
    const rotated = rotateEncryption(original, oldKey, newKey, 2);

    // Should be decryptable with new key
    expect(decrypt(rotated.encrypted, newKey)).toBe('my-refresh-token');
    expect(rotated.keyVersion).toBe(2);

    // Should NOT be decryptable with old key
    expect(() => decrypt(rotated.encrypted, oldKey)).toThrow();
  });

  it('should preserve plaintext through rotation', () => {
    const key1 = randomBytes(32).toString('hex');
    const key2 = randomBytes(32).toString('hex');
    const key3 = randomBytes(32).toString('hex');

    const plaintext = 'Cláusula legal § 2.5 — token secreto';

    // Encrypt with key1, rotate to key2, then key3
    const enc1 = encrypt(plaintext, key1);
    const enc2 = rotateEncryption(enc1, key1, key2, 2);
    const enc3 = rotateEncryption(enc2.encrypted, key2, key3, 3);

    expect(decrypt(enc3.encrypted, key3)).toBe(plaintext);
    expect(enc3.keyVersion).toBe(3);
  });
});
