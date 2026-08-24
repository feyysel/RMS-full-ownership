import { prisma } from "@/lib/prisma";

export async function treeRestaurantIds(restaurantId: string): Promise<string[]> {
  const me = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, parentId: true },
  });
  if (!me) return [restaurantId];
  const mainId = me.parentId ?? me.id;
  const branches = await prisma.restaurant.findMany({
    where: { parentId: mainId },
    select: { id: true },
  });
  return [mainId, ...branches.map((b) => b.id)];
}
