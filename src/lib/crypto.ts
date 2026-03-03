import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
// Auth tag is 16 bytes by default for GCM

const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY is required in production");
    }
    // Dev fallback: deterministic 32-byte key for consistent dev behavior
    // "dev-encryption-key-32-bytes-long!!"
    return Buffer.from("6465762d656e6372797074696f6e2d6b65792d33322d62797465732d6c6f6e672121", "hex"); 
  }
  // Ensure key is 32 bytes (256 bits)
  const buffer = Buffer.from(key, "hex");
  if (buffer.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be a 32-byte hex string");
  }
  return buffer;
};

export async function encrypt(text: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export async function decrypt(encryptedText: string): Promise<string> {
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getEncryptionKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
