import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER", "WAITER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const assignedTo = new URL(req.url).searchParams.get("assignedTo");
  const waiterFilter =
    session.role === "WAITER"
      ? assignedTo === null
        ? { waiterId: session.id }
        : { waiterId: assignedTo === session.id ? session.id : "__none__" }
      : {};

  const tables = await prisma.table.findMany({
    where: { restaurantId: session.restaurantId, ...waiterFilter },
    select: {
      id: true,
      number: true,
      code: true,
      status: true,
      waiter: { select: { id: true, name: true } },
      bellCalls: {
        where: { status: "RINGING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      },
      orders: {
        where: {
          status: { in: ["PENDING", "ACCEPTED", "COOKING", "READY", "SERVED"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          waiter: { select: { id: true, name: true } },
          items: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { number: "asc" },
  });

  return NextResponse.json({ tables });
}

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  try {
    const { number, waiterId } = await req.json();
    if (!number)
      return NextResponse.json({ error: "Table number is required" }, { status: 400 });

    const existing = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId: session.restaurantId, number } },
    });
    if (existing)
      return NextResponse.json({ error: "Table number already exists" }, { status: 409 });

    const { randomUUID } = await import("node:crypto");
    const table = await prisma.table.create({
      data: {
        number,
        waiterId: waiterId ?? null,
        restaurantId: session.restaurantId,
        code: `T${session.restaurantId.slice(0, 6)}-${number}-${randomUUID().slice(0, 4)}`,
      },
    });

    return NextResponse.json({ table });
  } catch (err) {
    console.error("create table error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
