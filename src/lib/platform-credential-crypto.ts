import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function deriveEncryptionKey(): Buffer {
  const raw =
    process.env.CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.TRAINING_ASSET_ACCESS_SECRET?.trim() ||
    (process.env.NODE_ENV !== "production"
      ? "mandato-dev-credentials-key-change-me"
      : "");

  if (!raw) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY nao configurada. Defina no Firebase App Hosting para salvar integracoes.",
    );
  }

  return createHash("sha256").update(raw).digest();
}

export type EncryptedCredentialPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function encryptPlatformCredential(plaintext: string): EncryptedCredentialPayload {
  const key = deriveEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptPlatformCredential(payload: EncryptedCredentialPayload): string {
  const key = deriveEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
