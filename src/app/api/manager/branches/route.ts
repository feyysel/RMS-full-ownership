import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { emitOwner, notify } from "@/lib/notify";
import { treeRestaurantIds } from "@/lib/restaurant-tree";

export const runtime = "nodejs";

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

  try {
    const scopeIds = session.role === "OWNER" ? await treeRestaurantIds(session.restaurantId) : [session.restaurantId];

    const restaurants = await prisma.restaurant.findMany({
      where: { id: { in: scopeIds } },
      include: {
        _count: { select: { tables: true, menuItems: true, users: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      restaurants,
      activeRestaurantId: session.restaurantId,
      canCreateBranches: session.role === "OWNER",
      canSwitch: session.role === "OWNER",
    });
  } catch (err) {
    console.error("get branches error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

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
    const { name, address, phone } = await req.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    }

    const me = await prisma.restaurant.findUnique({
      where: { id: session.restaurantId },
      select: { id: true, parentId: true },
    });
    if (!me) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    const mainId = me.parentId ?? me.id;

    const branch = await prisma.restaurant.create({
      data: {
        name,
        address: address || null,
        phone: phone || null,
        parentId: mainId,
      },
    });

    await notify({
      userId: session.id,
      restaurantId: mainId,
      type: "BRANCH_CREATED",
      title: "Branch created",
      body: `Your new branch "${branch.name}" has been created and is ready to manage.`,
    });
    await emitOwner("BRANCH_CREATED", { id: branch.id, name: branch.name });

    return NextResponse.json({ restaurant: branch });
  } catch (err) {
    console.error("create branch error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
