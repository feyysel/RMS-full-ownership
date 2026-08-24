import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME } from "@/lib/constants";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";

export default async function ManagerLayout({ children }: LayoutProps<"/manager">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER" && session.role !== "MANAGER")
    redirect(ROLE_HOME[session.role] ?? "/login");

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

  const nav: NavItem[] = [
    { label: "Overview", href: "/manager", icon: "LayoutDashboard" },
    { label: "My Restaurants", href: "/manager/branches", icon: "Store" },
    { label: "Employees", href: "/manager/employees", icon: "Users" },
    { label: "Menu", href: "/manager/menu", icon: "UtensilsCrossed" },
    { label: "Tables", href: "/manager/tables", icon: "Grid3X3" },
    ...(session.role === "OWNER"
      ? [{ label: "Insights", href: "/manager/insights", icon: "BarChart3" } satisfies NavItem]
      : []),
    { label: "Settings", href: "/manager/settings", icon: "Settings" },
  ];

  return (
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
  );
}
