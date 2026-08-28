import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: "OWNER" | "MANAGER" | "KITCHEN" | "WAITER" | "CASHIER";
  restaurantId: string | null;
};

const COOKIE_NAME = "rms_session";

function getSecret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET ?? "rms-dev-secret-change-me"
  );
}

let secretCache: ReturnType<typeof getSecret> | null = null;
function getSecretCached() {
  if (!secretCache) secretCache = getSecret();
  return secretCache;
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    name: user.name,
    phone: user.phone,
    role: user.role,
    restaurantId: user.restaurantId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecretCached());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

const sessionCache = new WeakMap<Request, SessionUser | null>();

async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretCached());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: (payload.name as string) ?? "",
      phone: (payload.phone as string) ?? "",
      role: payload.role as SessionUser["role"],
      restaurantId: (payload.restaurantId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromRequest(req: Request) {
  if (sessionCache.has(req)) return sessionCache.get(req)!;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)rms_session=([^;]+)/);
  const token = match?.[1];
  if (!token) {
    sessionCache.set(req, null);
    return null;
  }
  const result = await verifyToken(token);
  sessionCache.set(req, result);
  return result;
}

export { COOKIE_NAME };
