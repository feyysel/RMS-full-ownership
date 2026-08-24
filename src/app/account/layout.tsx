import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME } from "@/lib/constants";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";
import { HomeProvider } from "./home-context";

const NAV: NavItem[] = [{ label: "My workspace", href: "/", icon: "LayoutDashboard" }];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const home = ROLE_HOME[session.role] ?? "/";
  const nav = NAV.map((item) => ({ ...item, href: home }));

  let restaurantName: string | null = null;
  let restaurantLogo: string | null = null;
  if (session.restaurantId) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.restaurantId },
      select: { name: true, logoUrl: true },
    });
    restaurantName = restaurant?.name ?? null;
    restaurantLogo = restaurant?.logoUrl ?? null;
  }

  return (
    <HomeProvider home={home}>
      <PortalShell
        user={{
          id: session.id,
          name: session.name,
          phone: session.phone,
          role: session.role,
          restaurantId: session.restaurantId,
        }}
        restaurantName={restaurantName}
        restaurantLogo={restaurantLogo}
        nav={nav}
      >
        {children}
      </PortalShell>
    </HomeProvider>
  );
}
