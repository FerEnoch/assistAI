import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Parse a 64-hex-char encryption key into a Buffer.
 * Throws if the key is not exactly 64 hex chars (32 bytes).
 */
function parseKey(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('Encryption key must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @returns Stored format: `iv_hex:authTag_hex:ciphertext_hex`
 * Each call produces a different output because of the random IV.
 */
export function encrypt(plaintext: string, hexKey: string): string {
  const key = parseKey(hexKey);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a ciphertext string produced by `encrypt()`.
 *
 * @param stored - Format: `iv_hex:authTag_hex:ciphertext_hex`
 * @returns The original plaintext
 * @throws If the auth tag is invalid (tampered data) or format is wrong
 */
export function decrypt(stored: string, hexKey: string): string {
  const key = parseKey(hexKey);
  const parts = stored.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format — expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Versioned encryption result — includes the key version used.
 * Used for key rotation: new encryptions use the current key version,
 * decryption tries the version stored with the ciphertext.
 */
export interface EncryptedWithVersion {
  /** Encrypted value in iv:authTag:ciphertext format */
  encrypted: string;
  /** Key version used for encryption */
  keyVersion: number;
}

/**
 * Encrypt with key version tracking for rotation support (A-090).
 *
 * @param plaintext - The value to encrypt
 * @param hexKey - Current encryption key (64 hex chars)
 * @param keyVersion - Current key version number
 * @returns Encrypted value with version metadata
 */
export function encryptWithVersion(
  plaintext: string,
  hexKey: string,
  keyVersion: number,
): EncryptedWithVersion {
  return {
    encrypted: encrypt(plaintext, hexKey),
    keyVersion,
  };
}

/**
 * Re-encrypt a value with a new key (key rotation).
 *
 * @param stored - Existing encrypted value
 * @param oldHexKey - Key used for the original encryption
 * @param newHexKey - New key to re-encrypt with
 * @param newKeyVersion - Version number for the new key
 * @returns Newly encrypted value with updated version
 */
export function rotateEncryption(
  stored: string,
  oldHexKey: string,
  newHexKey: string,
  newKeyVersion: number,
): EncryptedWithVersion {
  const plaintext = decrypt(stored, oldHexKey);
  return encryptWithVersion(plaintext, newHexKey, newKeyVersion);
}
