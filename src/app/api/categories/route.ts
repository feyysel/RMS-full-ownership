import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  try {
    const { name } = await req.json();
    if (!name)
      return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const existing = await prisma.category.findUnique({
      where: { restaurantId_name: { restaurantId: session.restaurantId, name } },
    });
    if (existing)
      return NextResponse.json({ error: "Category already exists" }, { status: 409 });

    const category = await prisma.category.create({
      data: { name, restaurantId: session.restaurantId },
    });
    return NextResponse.json({ category });
  } catch (err) {
    console.error("create category error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
