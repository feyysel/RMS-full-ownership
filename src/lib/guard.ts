import { NextResponse } from "next/server";
import { getSessionFromRequest, type SessionUser } from "@/lib/session";

export async function requireRoles(
  req: Request,
  roles: SessionUser["role"][]
): Promise<{ session: SessionUser } | { response: NextResponse }> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!roles.includes(session.role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}
