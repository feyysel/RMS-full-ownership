import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      restaurantId: true,
      restaurant: { select: { id: true, name: true, theme: true, logoUrl: true } },
    },
  });

  return NextResponse.json({ user });
}
