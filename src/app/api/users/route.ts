import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireRoles } from "@/lib/guard";
import { emitOwner } from "@/lib/notify";
import { treeRestaurantIds } from "@/lib/restaurant-tree";

export const runtime = "nodejs";

const ASSIGNABLE_ROLES: Record<string, string> = {
  MANAGER: "MANAGER",
  KITCHEN: "KITCHEN",
  WAITER: "WAITER",
};

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;

  if (!session.restaurantId) {
    return NextResponse.json(
      { error: "You are not assigned to a restaurant" },
      { status: 400 }
    );
  }

  try {
    const { name, phone, password, role, restaurantId } = await req.json();

    if (!name || !phone || !password || !ASSIGNABLE_ROLES[role]) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (role === "MANAGER" && session.role !== "OWNER") {
      return NextResponse.json({ error: "Only the owner can create manager accounts" }, { status: 403 });
    }

    let targetRestaurantId: string;
    if (session.role === "MANAGER") {
      targetRestaurantId = session.restaurantId;
    } else if (restaurantId && restaurantId !== session.restaurantId) {
      const treeIds = await treeRestaurantIds(session.restaurantId);
      if (!treeIds.includes(restaurantId)) {
        return NextResponse.json(
          { error: "You do not have access to this restaurant" },
          { status: 403 }
        );
      }
      targetRestaurantId = restaurantId;
    } else {
      targetRestaurantId = session.restaurantId;
    }

    const exists = await prisma.user.findUnique({
      where: { phone: phone.trim() },
    });
    if (exists) {
      return NextResponse.json({ error: "Phone number already in use" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        phone: phone.trim(),
        passwordHash: await hashPassword(password),
        role,
        restaurantId: targetRestaurantId,
      },
    });

    await emitOwner("USER_CREATED", { id: user.id, name: user.name, role: user.role });

    return NextResponse.json({ user });
  } catch (err) {
    console.error("create user error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;

  if (!session.restaurantId) {
    return NextResponse.json(
      { error: "You are not assigned to a restaurant" },
      { status: 400 }
    );
  }

  let users;
  if (session.role === "OWNER") {
    const treeIds = await treeRestaurantIds(session.restaurantId);
    users = await prisma.user.findMany({
      where: { restaurantId: { in: treeIds } },
      include: { restaurant: { select: { id: true, name: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    });
  } else {
    users = await prisma.user.findMany({
      where: { restaurantId: session.restaurantId, role: { in: ["WAITER", "KITCHEN"] } },
      include: { restaurant: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      restaurantId: u.restaurantId,
      restaurantName: u.restaurant?.name ?? null,
    })),
  });
}
