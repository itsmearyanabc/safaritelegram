import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Attempt to find the user
    let user = await prisma.user.findUnique({
      where: { username },
    });

    // Automatically create the admin user if it doesn't exist (for setup convenience as requested)
    if (!user && username === "admin" && password === "admin 123") {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          passwordPlain: password, // As requested in the platform's user management logic
          role: "SUPERADMIN",
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Verify Password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Verify Role
    if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized access. Admin privileges required." }, { status: 403 });
    }

    // Create Session
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
      },
    });
  } catch (error: any) {
    console.error("Admin Login error:", error);
    return NextResponse.json({ error: "Internal server error during login" }, { status: 500 });
  }
}
