import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/* ------------------------------------------------------------------ */
/* Token encryption at rest: AES-256-GCM, Node built-ins only.         */
/*                                                                     */
/* Key: ENCRYPTION_KEY env var — exactly 32 bytes, base64 encoded.     */
/* Generate one with:  openssl rand -base64 32                         */
/*                                                                     */
/* Stored format: "v1:" + base64( iv(12) | authTag(16) | ciphertext ). */
/* The version prefix exists so a future key rotation can decrypt old  */
/* values with ENCRYPTION_KEY_PREVIOUS without a schema change.        */
/*                                                                     */
/* Decryption happens only in server-side modules. Plaintext tokens    */
/* must never appear in API responses, cookies, or client bundles.     */
/* ------------------------------------------------------------------ */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)"
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const [version, payload] = stored.split(":");
  if (version !== VERSION || !payload) {
    throw new Error(`Unsupported token ciphertext version: ${version}`);
  }
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
