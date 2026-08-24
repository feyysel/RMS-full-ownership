import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  try {
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== session.restaurantId)
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (typeof body.description === "string") data.description = body.description;
    if (typeof body.ingredients === "string") data.ingredients = body.ingredients;
    if (typeof body.price === "number") data.price = body.price;
    if (typeof body.imageUrl === "string") data.imageUrl = body.imageUrl;
    if (typeof body.available === "boolean") data.available = body.available;
    if (typeof body.isPopular === "boolean") data.isPopular = body.isPopular;
    if (typeof body.categoryId === "string") data.categoryId = body.categoryId;

    const item = await prisma.menuItem.update({ where: { id }, data });

    await notify({
      role: "WAITER",
      restaurantId: session.restaurantId!,
      type: "MENU_UPDATE",
      title: "Menu updated",
      body: `"${item.name}" was updated.`,
    });

    return NextResponse.json({ item });
  } catch (err) {
    console.error("update menu item error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  const { id } = await ctx.params;

  try {
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== session.restaurantId)
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });

    await prisma.menuItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete menu item error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
