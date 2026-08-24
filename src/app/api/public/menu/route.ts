import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code)
    return NextResponse.json({ error: "Table code is required" }, { status: 400 });

  const table = await prisma.table.findUnique({
    where: { code },
    include: {
      restaurant: {
        include: {
          categories: { include: { menuItems: true }, orderBy: { sortOrder: "asc" } },
          menuItems: {
            where: { categoryId: null },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!table)
    return NextResponse.json({ error: "Invalid table code" }, { status: 404 });

  return NextResponse.json(
    {
      restaurant: {
        id: table.restaurant.id,
        name: table.restaurant.name,
        theme: table.restaurant.theme ?? null,
      },
      table: {
        id: table.id,
        number: table.number,
        code: table.code,
      },
      categories: table.restaurant.categories
        .map((c) => ({
          id: c.id,
          name: c.name,
          items: c.menuItems.filter((m) => m.available),
        }))
        .filter((c) => c.items.length > 0),
      uncategorized: table.restaurant.menuItems.filter((m) => m.available),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
      },
    }
  );
}
