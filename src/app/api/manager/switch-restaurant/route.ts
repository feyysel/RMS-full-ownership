import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;

  if (!session.restaurantId) {
    return NextResponse.json(
      { error: "You are not assigned to a restaurant" },
      { status: 400 }
    );
  }

  try {
    const { restaurantId } = await req.json();
    if (typeof restaurantId !== "string" || !restaurantId) {
      return NextResponse.json({ error: "Restaurant is required" }, { status: 400 });
    }

    const me = await prisma.restaurant.findUnique({
      where: { id: session.restaurantId },
      select: { id: true, parentId: true },
    });
    if (!me) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    const mainId = me.parentId ?? me.id;

    const target = await prisma.restaurant.findFirst({
      where: {
        id: restaurantId,
        OR: [{ id: mainId }, { parentId: mainId }],
      },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: "You do not have access to this restaurant" },
        { status: 403 }
      );
    }

    await createSession({
      id: session.id,
      name: session.name,
      phone: session.phone,
      role: session.role,
      restaurantId: target.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("switch restaurant error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
