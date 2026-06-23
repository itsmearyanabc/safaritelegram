import { cookies } from "next/headers";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "safari_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "safari_boys_super_secret_key_123456789";

interface SessionPayload {
  userId: string;
  role: string;
  username: string;
}

// Simple secure signing helper
function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    crypto.scryptSync(SESSION_SECRET, "salt", 32),
    Buffer.alloc(16, 0)
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function decrypt(encryptedText: string): string {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      crypto.scryptSync(SESSION_SECRET, "salt", 32),
      Buffer.alloc(16, 0)
    );
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (e) {
    return "";
  }
}

export async function createSession(payload: SessionPayload) {
  const sessionStr = JSON.stringify({
    ...payload,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  const encrypted = encrypt(sessionStr);
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60, // 24 hours
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }
  
  const decrypted = decrypt(sessionCookie.value);
  if (!decrypted) return null;
  
  try {
    const data = JSON.parse(decrypted);
    if (data.expiresAt < Date.now()) {
      return null; // expired
    }
    return {
      userId: data.userId,
      role: data.role,
      username: data.username,
    };
  } catch (e) {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
