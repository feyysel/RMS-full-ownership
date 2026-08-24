import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME } from "@/lib/constants";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";

const NAV: NavItem[] = [
  { label: "Live Queue", href: "/kitchen", icon: "ListChecks" },
  { label: "Receipts", href: "/kitchen/receipts", icon: "ReceiptText" },
];

export default async function KitchenLayout({ children }: LayoutProps<"/kitchen">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "KITCHEN") redirect(ROLE_HOME[session.role] ?? "/login");

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
      nav={NAV}
    >
      {children}
    </PortalShell>
  );
}
