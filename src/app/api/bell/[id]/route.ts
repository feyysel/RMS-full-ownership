import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["WAITER", "MANAGER", "OWNER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  try {
    const bell = await prisma.bellCall.findUnique({
      where: { id },
      include: { table: true },
    });
    if (!bell || bell.table.restaurantId !== session.restaurantId)
      return NextResponse.json({ error: "Bell not found" }, { status: 404 });

    const updated = await prisma.bellCall.update({
      where: { id },
      data: { status: "RESPONDED", resolvedAt: new Date(), respondedBy: session.id },
    });

    return NextResponse.json({ bellCall: updated });
  } catch (err) {
    console.error("respond bell error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
