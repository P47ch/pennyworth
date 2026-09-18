import { describe, expect, it } from "vitest";
import {
  decryptBackupJson,
  encryptBackupJson,
  encryptedBackupFormat,
  encryptedBackupFormatVersion,
  EncryptedBackupError,
  EncryptedBackupPassphraseError,
  isPotentialEncryptedBackup,
  maximumEncryptedBackupEnvelopeBytes,
  maximumEncryptedBackupPlaintextBytes
} from "../src/services/encryptedBackup.js";

const passphrase = "correct horse battery staple";
const plaintext = JSON.stringify({ app: "Pennyworth", transaction: { description: "Salary", amountMinor: 123_456 } });

function changedEnvelope(envelope: string, mutate: (value: Record<string, unknown>) => void): string {
  const value = JSON.parse(envelope) as Record<string, unknown>;
  mutate(value);
  return JSON.stringify(value);
}

describe("encrypted backup envelope", () => {
  it("round-trips the documented format and keeps repeated exports distinct", async () => {
    const [first, second] = await Promise.all([
      encryptBackupJson(plaintext, passphrase),
      encryptBackupJson(plaintext, passphrase)
    ]);

    const firstEnvelope = JSON.parse(first) as Record<string, unknown>;
    const secondEnvelope = JSON.parse(second) as Record<string, unknown>;

    expect(firstEnvelope).toMatchObject({
      format: encryptedBackupFormat,
      version: encryptedBackupFormatVersion,
      kdf: { algorithm: "scrypt", N: 131_072, r: 8, p: 1, keyLength: 32 },
      cipher: { algorithm: "aes-256-gcm" }
    });
    expect(firstEnvelope.salt).not.toBe(secondEnvelope.salt);
    expect(firstEnvelope.nonce).not.toBe(secondEnvelope.nonce);
    expect(firstEnvelope.ciphertext).not.toBe(secondEnvelope.ciphertext);
    expect(first).not.toContain("Salary");
    await expect(decryptBackupJson(first, passphrase)).resolves.toBe(plaintext);
  });

  it("decrypts the published known vector", async () => {
    const vector = "{\"format\":\"pennyworth-encrypted-backup\",\"version\":1,\"kdf\":{\"algorithm\":\"scrypt\",\"N\":131072,\"r\":8,\"p\":1,\"keyLength\":32},\"cipher\":{\"algorithm\":\"aes-256-gcm\"},\"salt\":\"TIPtsxSDKlD43YKr18jixg==\",\"nonce\":\"YJBEAfDL6C3MbQPH\",\"tag\":\"6czHAmpCJTEKE2nxPTSnAQ==\",\"ciphertext\":\"OclItQk8Tj6RjnQQ6a3wdKoI7R34\"}";

    await expect(decryptBackupJson(vector, "vector passphrase")).resolves.toBe("test vector plaintext");
  });

  it("continues to decrypt legacy envelopes that used short passphrases", async () => {
    const legacyEnvelope = "{\"format\":\"pennyworth-encrypted-backup\",\"version\":1,\"kdf\":{\"algorithm\":\"scrypt\",\"N\":131072,\"r\":8,\"p\":1,\"keyLength\":32},\"cipher\":{\"algorithm\":\"aes-256-gcm\"},\"salt\":\"AQEBAQEBAQEBAQEBAQEBAQ==\",\"nonce\":\"AgICAgICAgICAgIC\",\"tag\":\"/ZOrk4+oA7oNOZxOaLgkpw==\",\"ciphertext\":\"fJjQZojv\"}";

    await expect(decryptBackupJson(legacyEnvelope, "a")).resolves.toBe("legacy");
  });

  it.each([
    ["wrong passphrase", (value: string) => value],
    ["modified ciphertext", (value: string) => changedEnvelope(value, (envelope) => { envelope.ciphertext = `A${String(envelope.ciphertext).slice(1)}`; })],
    ["modified tag", (value: string) => changedEnvelope(value, (envelope) => { envelope.tag = `A${String(envelope.tag).slice(1)}`; })],
    ["modified salt", (value: string) => changedEnvelope(value, (envelope) => { envelope.salt = `A${String(envelope.salt).slice(1)}`; })],
    ["modified metadata", (value: string) => changedEnvelope(value, (envelope) => { envelope.nonce = "AAAAAAAAAAAAAAAA"; })],
    ["unsupported KDF", (value: string) => changedEnvelope(value, (envelope) => { (envelope.kdf as Record<string, unknown>).N = 2; })],
    ["truncated envelope", (value: string) => value.slice(0, -5)]
  ])("fails safely for %s", async (label, mutate) => {
    const envelope = await encryptBackupJson(plaintext, passphrase);
    const candidate = mutate(envelope);
    const candidatePassphrase = label === "wrong passphrase" ? "not the passphrase" : passphrase;

    await expect(decryptBackupJson(candidate, candidatePassphrase)).rejects.toBeInstanceOf(EncryptedBackupError);
  });

  it("enforces strict resource and input limits before key derivation", async () => {
    await expect(encryptBackupJson("", passphrase)).rejects.toBeInstanceOf(EncryptedBackupError);
    await expect(encryptBackupJson("x", "")).rejects.toBeInstanceOf(EncryptedBackupError);
    await expect(encryptBackupJson("x", "a")).rejects.toBeInstanceOf(EncryptedBackupPassphraseError);
    await expect(encryptBackupJson("x", "p".repeat(1025))).rejects.toBeInstanceOf(EncryptedBackupError);
    await expect(encryptBackupJson("x".repeat(maximumEncryptedBackupPlaintextBytes + 1), passphrase)).rejects.toBeInstanceOf(EncryptedBackupError);
    await expect(decryptBackupJson(" ".repeat(maximumEncryptedBackupEnvelopeBytes + 1), passphrase)).rejects.toBeInstanceOf(EncryptedBackupError);
  });

  it("preserves Unicode passphrases without normalization", async () => {
    const unicodePassphrase = "Néve 🔐 例 con parole";
    const envelope = await encryptBackupJson(plaintext, unicodePassphrase);

    await expect(decryptBackupJson(envelope, unicodePassphrase)).resolves.toBe(plaintext);
    await expect(decryptBackupJson(envelope, "Neve 🔐 例 con parole")).rejects.toBeInstanceOf(EncryptedBackupError);
  });

  it("distinguishes potential encrypted envelopes from ordinary JSON backups without trusting a filename", () => {
    expect(isPotentialEncryptedBackup('{"app":"Pennyworth","schemaVersion":9}')).toBe(false);
    expect(isPotentialEncryptedBackup('{"format":"pennyworth-encrypted-backup"}')).toBe(true);
    expect(isPotentialEncryptedBackup('{"format":"pennyworth-encrypted-backup"')).toBe(true);
  });

  it("bounds concurrent key derivation work", async () => {
    const envelope = await encryptBackupJson(plaintext, passphrase);
    const results = await Promise.allSettled([
      decryptBackupJson(envelope, passphrase),
      decryptBackupJson(envelope, passphrase),
      decryptBackupJson(envelope, passphrase),
      decryptBackupJson(envelope, passphrase)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
