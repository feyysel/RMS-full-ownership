import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { id: true, name: true, address: true, phone: true, theme: true, logoUrl: true },
  });
  if (!restaurant)
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  return NextResponse.json({ restaurant });
}

export async function PATCH(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  try {
    const { logoUrl } = await req.json();
    if (logoUrl !== null && typeof logoUrl !== "string") {
      return NextResponse.json({ error: "logoUrl must be a string or null" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.update({
      where: { id: session.restaurantId },
      data: { logoUrl: logoUrl ?? null },
      select: { id: true, name: true, logoUrl: true },
    });

    return NextResponse.json({ restaurant });
  } catch (err) {
    console.error("update restaurant logo error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
