import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";

export const encryptedBackupFormat = "pennyworth-encrypted-backup";
export const encryptedBackupFormatVersion = 1;
export const maximumEncryptedBackupPlaintextBytes = 10 * 1024 * 1024;
export const maximumEncryptedBackupEnvelopeBytes = 14 * 1024 * 1024;

const keyLength = 32;
const saltLength = 16;
const nonceLength = 12;
const authenticationTagLength = 16;
const maximumPassphraseBytes = 1024;
const minimumExportPassphraseCharacters = 12;
const scryptParameters = { algorithm: "scrypt", N: 131_072, r: 8, p: 1, keyLength } as const;
const cipherAlgorithm = "aes-256-gcm";
const scryptMaximumMemory = 256 * 1024 * 1024;
const maximumConcurrentKdfOperations = 1;
const maximumQueuedKdfOperations = 2;
let activeKdfOperations = 0;
const kdfWaiters: Array<() => void> = [];

type EncryptedBackupEnvelope = {
  format: typeof encryptedBackupFormat;
  version: typeof encryptedBackupFormatVersion;
  kdf: typeof scryptParameters;
  cipher: { algorithm: typeof cipherAlgorithm };
  salt: string;
  nonce: string;
  tag: string;
  ciphertext: string;
};

export class EncryptedBackupError extends Error {
  constructor() {
    super("Encrypted backup could not be opened. Check the passphrase and file, then try again.");
    this.name = "EncryptedBackupError";
  }
}

export class EncryptedBackupPassphraseError extends Error {
  constructor() {
    super(`Backup passphrase must be at least ${minimumExportPassphraseCharacters} characters.`);
    this.name = "EncryptedBackupPassphraseError";
  }
}

function invalidEncryptedBackup(): never {
  throw new EncryptedBackupError();
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function assertPassphrase(passphrase: string) {
  if (!passphrase || byteLength(passphrase) > maximumPassphraseBytes) {
    invalidEncryptedBackup();
  }
}

function assertExportPassphrase(passphrase: string) {
  assertPassphrase(passphrase);

  if (Array.from(passphrase).length < minimumExportPassphraseCharacters) {
    throw new EncryptedBackupPassphraseError();
  }
}

async function acquireKdfSlot(): Promise<() => void> {
  if (activeKdfOperations >= maximumConcurrentKdfOperations) {
    if (kdfWaiters.length >= maximumQueuedKdfOperations) {
      invalidEncryptedBackup();
    }

    await new Promise<void>((resolve) => kdfWaiters.push(resolve));
  }

  activeKdfOperations += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeKdfOperations -= 1;
    kdfWaiters.shift()?.();
  };
}

function encodeBase64(value: Buffer): string {
  return value.toString("base64");
}

function decodeBase64(value: unknown, expectedLength?: number): Buffer {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    invalidEncryptedBackup();
  }

  const decoded = Buffer.from(value, "base64");

  if (decoded.toString("base64") !== value || (expectedLength !== undefined && decoded.length !== expectedLength)) {
    invalidEncryptedBackup();
  }

  return decoded;
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidEncryptedBackup();
  }

  return value as Record<string, unknown>;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) {
    invalidEncryptedBackup();
  }
}

function canonicalAdditionalData(envelope: Pick<EncryptedBackupEnvelope, "format" | "version" | "kdf" | "cipher" | "salt" | "nonce">): Buffer {
  return Buffer.from(
    JSON.stringify({
      format: envelope.format,
      version: envelope.version,
      kdf: envelope.kdf,
      cipher: envelope.cipher,
      salt: envelope.salt,
      nonce: envelope.nonce
    }),
    "utf8"
  );
}

function parseEnvelope(serializedEnvelope: string): EncryptedBackupEnvelope {
  if (!serializedEnvelope || byteLength(serializedEnvelope) > maximumEncryptedBackupEnvelopeBytes) {
    invalidEncryptedBackup();
  }

  let value: unknown;

  try {
    value = JSON.parse(serializedEnvelope);
  } catch {
    invalidEncryptedBackup();
  }

  const envelope = objectValue(value);
  hasOnlyKeys(envelope, ["format", "version", "kdf", "cipher", "salt", "nonce", "tag", "ciphertext"]);
  const kdf = objectValue(envelope.kdf);
  const cipher = objectValue(envelope.cipher);
  hasOnlyKeys(kdf, ["algorithm", "N", "r", "p", "keyLength"]);
  hasOnlyKeys(cipher, ["algorithm"]);

  if (
    envelope.format !== encryptedBackupFormat ||
    envelope.version !== encryptedBackupFormatVersion ||
    kdf.algorithm !== scryptParameters.algorithm ||
    kdf.N !== scryptParameters.N ||
    kdf.r !== scryptParameters.r ||
    kdf.p !== scryptParameters.p ||
    kdf.keyLength !== scryptParameters.keyLength ||
    cipher.algorithm !== cipherAlgorithm
  ) {
    invalidEncryptedBackup();
  }

  const salt = decodeBase64(envelope.salt, saltLength);
  const nonce = decodeBase64(envelope.nonce, nonceLength);
  const tag = decodeBase64(envelope.tag, authenticationTagLength);
  const ciphertext = decodeBase64(envelope.ciphertext);

  if (!ciphertext.length || ciphertext.length > maximumEncryptedBackupPlaintextBytes) {
    invalidEncryptedBackup();
  }

  return {
    format: encryptedBackupFormat,
    version: encryptedBackupFormatVersion,
    kdf: scryptParameters,
    cipher: { algorithm: cipherAlgorithm },
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
    tag: encodeBase64(tag),
    ciphertext: encodeBase64(ciphertext)
  };
}

async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  assertPassphrase(passphrase);
  const releaseKdfSlot = await acquireKdfSlot();
  const passphraseBuffer = Buffer.from(passphrase, "utf8");

  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        passphraseBuffer,
        salt,
        keyLength,
        {
          N: scryptParameters.N,
          r: scryptParameters.r,
          p: scryptParameters.p,
          maxmem: scryptMaximumMemory
        },
        (error, key) => error ? reject(error) : resolve(key)
      );
    });
  } catch {
    invalidEncryptedBackup();
  } finally {
    passphraseBuffer.fill(0);
    releaseKdfSlot();
  }
}

export function isPotentialEncryptedBackup(serializedBackup: string): boolean {
  try {
    const value = JSON.parse(serializedBackup) as unknown;

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return ["format", "version", "kdf", "cipher", "salt", "nonce", "tag", "ciphertext"].some((key) => key in value);
  } catch {
    return serializedBackup.includes(encryptedBackupFormat);
  }
}

export async function encryptBackupJson(backupJson: string, passphrase: string): Promise<string> {
  assertExportPassphrase(passphrase);
  const plaintext = Buffer.from(backupJson, "utf8");

  if (!plaintext.length || plaintext.length > maximumEncryptedBackupPlaintextBytes) {
    invalidEncryptedBackup();
  }

  const salt = randomBytes(saltLength);
  const nonce = randomBytes(nonceLength);
  const envelope = {
    format: encryptedBackupFormat,
    version: encryptedBackupFormatVersion,
    kdf: scryptParameters,
    cipher: { algorithm: cipherAlgorithm },
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce)
  } as const;
  const key = await deriveKey(passphrase, salt);

  try {
    const cipher = createCipheriv(cipherAlgorithm, key, nonce, { authTagLength: authenticationTagLength });
    cipher.setAAD(canonicalAdditionalData(envelope));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const serialized = JSON.stringify({ ...envelope, tag: encodeBase64(cipher.getAuthTag()), ciphertext: encodeBase64(ciphertext) });

    if (byteLength(serialized) > maximumEncryptedBackupEnvelopeBytes) {
      invalidEncryptedBackup();
    }

    return serialized;
  } finally {
    key.fill(0);
  }
}

export async function decryptBackupJson(serializedEnvelope: string, passphrase: string): Promise<string> {
  const envelope = parseEnvelope(serializedEnvelope);
  const salt = decodeBase64(envelope.salt, saltLength);
  const nonce = decodeBase64(envelope.nonce, nonceLength);
  const tag = decodeBase64(envelope.tag, authenticationTagLength);
  const ciphertext = decodeBase64(envelope.ciphertext);
  const key = await deriveKey(passphrase, salt);

  try {
    const decipher = createDecipheriv(cipherAlgorithm, key, nonce, { authTagLength: authenticationTagLength });
    decipher.setAAD(canonicalAdditionalData(envelope));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    if (!plaintext.length || plaintext.length > maximumEncryptedBackupPlaintextBytes) {
      invalidEncryptedBackup();
    }

    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  } catch (error) {
    if (error instanceof EncryptedBackupError) {
      throw error;
    }

    invalidEncryptedBackup();
  } finally {
    key.fill(0);
  }
}
