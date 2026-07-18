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

    // 3. Check for Env Admin Override
    const envAdminId = process.env.ADMIN_ID;
    const envAdminPassword = process.env.ADMIN_PASSWORD;

    if (envAdminId && envAdminPassword && username === envAdminId && password === envAdminPassword) {
      let superAdmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
      const salt = await bcrypt.genSalt(10);
      
      if (!superAdmin) {
        // If no superadmin exists, seamlessly create one!
        superAdmin = await prisma.user.create({
          data: {
            username: envAdminId,
            passwordPlain: envAdminPassword,
            passwordHash: await bcrypt.hash(envAdminPassword, salt),
            role: "SUPERADMIN",
          },
        });
        
        // Ensure they have a wallet too
        await prisma.wallet.create({
          data: { userId: superAdmin.id, balance: 0.0 },
        });
      } else {
        // Sync existing admin DB if they don't match
        if (superAdmin.username !== envAdminId || superAdmin.passwordPlain !== envAdminPassword) {
          superAdmin = await prisma.user.update({
            where: { id: superAdmin.id },
            data: {
              username: envAdminId,
              passwordPlain: envAdminPassword,
              passwordHash: await bcrypt.hash(envAdminPassword, salt),
            },
          });
        }
      }

      await createSession({
        userId: superAdmin.id,
        role: superAdmin.role,
        username: superAdmin.username,
      });

      return NextResponse.json({
        user: {
          id: superAdmin.id,
          username: superAdmin.username,
          role: superAdmin.role,
          telegramUsername: superAdmin.telegramUsername,
          telegramId: superAdmin.telegramId,
        },
      });
    }

    // 4. Fallback to normal DB login
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

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
