import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE_HOME } from "@/lib/constants";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";

const NAV: NavItem[] = [
  { label: "Take Orders", href: "/cashier", icon: "Coins" },
  { label: "Receipt History", href: "/cashier/receipts", icon: "ReceiptText" },
];

const RESTAURANT_SELECT = { name: true, logoUrl: true } as const;

export default async function CashierLayout({ children }: LayoutProps<"/cashier">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "CASHIER") redirect(ROLE_HOME[session.role] ?? "/login");

  let restaurantName: string | null = null;
  let restaurantLogo: string | null = null;
  if (session.restaurantId) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.restaurantId },
      select: RESTAURANT_SELECT,
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
