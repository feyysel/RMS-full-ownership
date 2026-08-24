import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return NextResponse.json(
        { error: "Phone number and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { phone: phone.trim() },
      include: { restaurant: { select: { id: true, name: true } } },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid phone number or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account has been deactivated" },
        { status: 403 }
      );
    }

    await createSession({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      restaurantId: user.restaurantId,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        restaurantId: user.restaurantId,
        restaurantName: user.restaurant?.name ?? null,
      },
    });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
