import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/guard";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  const [items, categories] = await Promise.all([
    prisma.menuItem.findMany({
      where: { restaurantId: session.restaurantId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { restaurantId: session.restaurantId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return NextResponse.json({ items, categories });
}

export async function POST(req: Request) {
  const guard = await requireRoles(req, ["OWNER", "MANAGER"]);
  if ("response" in guard) return guard.response;
  const session = guard.session;
  if (!session.restaurantId)
    return NextResponse.json({ error: "No restaurant assigned" }, { status: 400 });

  try {
    const { name, description, ingredients, price, imageUrl, categoryId, categoryName, available, isPopular } =
      await req.json();

    if (!name || typeof price !== "number") {
      return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
    }

    let resolvedCategoryId = categoryId ?? null;
    if (categoryName) {
      const existing = await prisma.category.findUnique({
        where: { restaurantId_name: { restaurantId: session.restaurantId, name: categoryName } },
      });
      if (existing) resolvedCategoryId = existing.id;
      else {
        const created = await prisma.category.create({
          data: {
            name: categoryName,
            restaurantId: session.restaurantId,
            sortOrder: 0,
          },
        });
        resolvedCategoryId = created.id;
      }
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        description: description ?? null,
        ingredients: ingredients ?? "",
        price,
        imageUrl: imageUrl ?? null,
        available: available ?? true,
        isPopular: isPopular ?? false,
        categoryId: resolvedCategoryId,
        restaurantId: session.restaurantId,
      },
    });

    await notify({
      role: "WAITER",
      restaurantId: session.restaurantId,
      type: "MENU_UPDATE",
      title: "Menu updated",
      body: `"${item.name}" was added to the menu.`,
    });

    return NextResponse.json({ item });
  } catch (err) {
    console.error("create menu item error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
