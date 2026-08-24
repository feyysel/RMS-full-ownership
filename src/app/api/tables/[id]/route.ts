import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER", "WAITER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  try {
    const existing = await prisma.table.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== session.restaurantId)
      return NextResponse.json({ error: "Table not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (session.role === "MANAGER") {
      if (typeof body.number === "number") data.number = body.number;
      if (typeof body.waiterId === "string") data.waiterId = body.waiterId;
      if (body.waiterId === null) data.waiterId = null;
    }
    if (typeof body.status === "string") data.status = body.status;

    const table = await prisma.table.update({ where: { id }, data });
    return NextResponse.json({ table });
  } catch (err) {
    console.error("update table error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  try {
    const existing = await prisma.table.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== session.restaurantId)
      return NextResponse.json({ error: "Table not found" }, { status: 404 });

    await prisma.table.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete table error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
