import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify, emitToTable } from "@/lib/notify";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get("code");
    if (!code)
      return NextResponse.json({ error: "Table code is required" }, { status: 400 });

    const table = await prisma.table.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!table)
      return NextResponse.json({ error: "Invalid table code" }, { status: 404 });

    const active = await prisma.bellCall.findFirst({
      where: { tableId: table.id, status: "RINGING" },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ringing: active !== null, bellCall: active });
  } catch (err) {
    console.error("bell status error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code)
      return NextResponse.json({ error: "Table code is required" }, { status: 400 });

    const table = await prisma.table.findUnique({
      where: { code },
      include: { waiter: true },
    });
    if (!table)
      return NextResponse.json({ error: "Invalid table code" }, { status: 404 });

    const active = await prisma.bellCall.findFirst({
      where: { tableId: table.id, status: "RINGING" },
    });
    if (active) {
      return NextResponse.json({ bellCall: active }, { status: 200 });
    }

    const bellCall = await prisma.bellCall.create({
      data: { tableId: table.id },
    });

    if (table.waiterId) {
      await notify({
        userId: table.waiterId,
        restaurantId: table.restaurantId,
        type: "BELL",
        title: `Bell at Table ${table.number}`,
        body: "A customer is requesting service.",
        tableId: table.id,
      });
    } else {
      await notify({
        role: "WAITER",
        restaurantId: table.restaurantId,
        type: "BELL",
        title: `Bell at Table ${table.number}`,
        body: "A customer is requesting service. No waiter assigned.",
        tableId: table.id,
      });
    }

    await emitToTable(table.code, "BELL", {
      id: bellCall.id,
      tableNumber: table.number,
      status: "RINGING",
      createdAt: bellCall.createdAt.toISOString(),
    });

    return NextResponse.json({ bellCall });
  } catch (err) {
    console.error("bell error", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
