import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "./constants";

interface SessionPayload {
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}

const getSessionSecret = () => process.env.AUTH_SESSION_SECRET ?? "dev-secret";

const sign = (value: string) =>
  createHmac("sha256", getSessionSecret()).update(value).digest("base64url");

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const toToken = (payload: SessionPayload): string => {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
};

const fromToken = (token: string): SessionPayload | null => {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = sign(encoded);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;
    if (Date.now() / 1000 >= payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const createUserId = () => `user_${randomUUID()}`;

export const createSessionToken = (userId: string, email: string) => {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: userId || createUserId(),
    email,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS
  };

  return toToken(payload);
};

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS
});

export async function createSession(userId: string, email: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(userId, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function readSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return fromToken(token);
}
