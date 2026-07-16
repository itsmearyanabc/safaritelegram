import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { decryptAnswer } from "../captcha/route";

export async function POST(req: Request) {
  try {
    const { username, password, captchaAnswer, captchaToken } = await req.json();

    // 1. CAPTCHA Validation
    if (!captchaToken || !captchaAnswer) {
      return NextResponse.json({ error: "CAPTCHA is required" }, { status: 400 });
    }

    const decrypted = decryptAnswer(captchaToken);
    if (!decrypted) {
      return NextResponse.json({ error: "Invalid CAPTCHA token" }, { status: 400 });
    }

    try {
      const captchaData = JSON.parse(decrypted);
      if (captchaData.expiresAt < Date.now()) {
        return NextResponse.json({ error: "CAPTCHA expired, please try again" }, { status: 400 });
      }
      if (captchaData.answer !== captchaAnswer.trim()) {
        return NextResponse.json({ error: "Incorrect CAPTCHA answer" }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Invalid CAPTCHA payload" }, { status: 400 });
    }

    // 2. Validate Inputs
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // 3. Find User
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // 4. Verify Password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // 5. Create Session
    await createSession({
      userId: user.id,
      role: user.role,
      username: user.username,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        telegramUsername: user.telegramUsername,
        telegramId: user.telegramId,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
