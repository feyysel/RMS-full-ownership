import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const restaurant = await prisma.restaurant.upsert({
    where: { id: "rest-golden-fork" },
    update: {},
    create: {
      id: "rest-golden-fork",
      name: "The Golden Fork",
      address: "42 Bistro Avenue, Downtown",
      phone: "+1 (555) 012-3456",
      theme: "amber",
    },
  });
  console.log("restaurant:", restaurant.name);

  const owner = await prisma.user.upsert({
    where: { phone: "0982101908" },
    update: { role: "OWNER", restaurantId: restaurant.id },
    create: {
      name: "Feysel Awel",
      phone: "0982101908",
      passwordHash: await hash("owner123", 10),
      role: "OWNER",
      restaurantId: restaurant.id,
    },
  });
  console.log("owner:", owner.phone, "/ owner123");

  const staff = [
    { name: "Daniel Kim", phone: "09171234568", role: "MANAGER", pass: "manager123", rest: restaurant.id },
    { name: "Sofia Martinez", phone: "09171234569", role: "WAITER", pass: "waiter123", rest: restaurant.id },
    { name: "Liam Johnson", phone: "09171234570", role: "WAITER", pass: "waiter123", rest: restaurant.id },
    { name: "Emma Chen", phone: "09171234571", role: "KITCHEN", pass: "kitchen123", rest: restaurant.id },
    { name: "Marco Rossi", phone: "09171234572", role: "KITCHEN", pass: "kitchen123", rest: restaurant.id },
    { name: "Ava Torres", phone: "09171234573", role: "CASHIER", pass: "cashier123", rest: restaurant.id },
  ];

  for (const s of staff) {
    const exists = await prisma.user.findUnique({ where: { phone: s.phone } });
    if (!exists) {
      await prisma.user.create({
        data: {
          name: s.name,
          phone: s.phone,
          passwordHash: await hash(s.pass, 10),
          role: s.role as never,
          restaurantId: s.rest,
        },
      });
    } else if (exists.restaurantId !== s.rest) {
      await prisma.user.update({
        where: { id: exists.id },
        data: { restaurantId: s.rest },
      });
    }
  }

  const categories = [
    { name: "Appetizers", sortOrder: 1 },
    { name: "Mains", sortOrder: 2 },
    { name: "Desserts", sortOrder: 3 },
    { name: "Drinks", sortOrder: 4 },
  ];

  const catIds: Record<string, string> = {};
  for (const c of categories) {
    const existing = await prisma.category.findUnique({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: c.name } },
    });
    if (existing) {
      catIds[c.name] = existing.id;
      continue;
    }
    const created = await prisma.category.create({
      data: { name: c.name, sortOrder: c.sortOrder, restaurantId: restaurant.id },
    });
    catIds[c.name] = created.id;
  }

  const img = (id: string, params = "auto=format&fit=crop&w=800&q=80") =>
    `https://images.unsplash.com/${id}?${params}`;

  const menu = [
    { name: "Truffle Fries", cat: "Appetizers", price: 8.5, popular: true, image: "photo-1518013431117-eb1465fa5752", desc: "Crispy golden fries tossed with black truffle oil, parmesan and chives.", ingredients: "Potatoes, Truffle oil, Parmesan, Chives, Sea salt" },
    { name: "Bruschetta", cat: "Appetizers", price: 9.0, popular: false, image: "photo-1572695157366-5e585ab2b69f", desc: "Grilled sourdough topped with vine tomatoes, basil and balsamic glaze.", ingredients: "Sourdough, Tomatoes, Basil, Balsamic glaze, Garlic, Olive oil" },
    { name: "Calamari Fritti", cat: "Appetizers", price: 12.0, popular: false, image: "photo-1583324113626-70df0f4deaab", desc: "Lightly fried squid served with lemon and spicy marinara.", ingredients: "Squid, Flour, Lemon, Marinara, Chili flakes" },
    { name: "Ribeye Steak", cat: "Mains", price: 34.0, popular: true, image: "photo-1546833999-b9f581a1996d", desc: "12oz prime ribeye, grilled to order, roasted garlic butter.", ingredients: "Ribeye, Garlic butter, Rosemary, Black pepper" },
    { name: "Grilled Salmon", cat: "Mains", price: 27.0, popular: true, image: "photo-1467003909585-2f8a72700288", desc: "Atlantic salmon with lemon herb butter and seasonal greens.", ingredients: "Salmon, Lemon, Herbs, Butter, Seasonal greens" },
    { name: "Wild Mushroom Risotto", cat: "Mains", price: 21.0, popular: false, image: "photo-1476124369491-e7addf5db371", desc: "Creamy arborio rice with porcini, parmesan and white wine.", ingredients: "Arborio rice, Porcini, Parmesan, White wine, Shallots" },
    { name: "Margherita Pizza", cat: "Mains", price: 16.0, popular: true, image: "photo-1574071318508-1cdbab80d002", desc: "Wood-fired with San Marzano tomatoes, fior di latte and basil.", ingredients: "Dough, San Marzano, Mozzarella, Basil, Olive oil" },
    { name: "Caesar Salad", cat: "Mains", price: 13.5, popular: false, image: "photo-1550304943-4f24f54ddde9", desc: "Crisp romaine, parmesan, croutons and house caesar dressing.", ingredients: "Romaine, Parmesan, Croutons, Caesar dressing" },
    { name: "Tiramisu", cat: "Desserts", price: 9.5, popular: true, image: "photo-1571877227200-a0d98ea607e9", desc: "Classic Italian tiramisu with espresso-soaked ladyfingers.", ingredients: "Mascarpone, Espresso, Ladyfingers, Cocoa, Marsala" },
    { name: "Molten Lava Cake", cat: "Desserts", price: 11.0, popular: true, image: "photo-1606313564200-e75d5e30476c", desc: "Warm chocolate cake with a gooey center, vanilla bean gelato.", ingredients: "Dark chocolate, Butter, Eggs, Flour, Vanilla gelato" },
    { name: "Cheesecake", cat: "Desserts", price: 9.0, popular: false, image: "photo-1533134242443-d4fd215305ad", desc: "New York style with mixed berry compote.", ingredients: "Cream cheese, Graham cracker, Berries, Sugar" },
    { name: "Iced Latte", cat: "Drinks", price: 5.5, popular: false, image: "photo-1517701604599-bb29b565090c", desc: "Double espresso shaken with milk over ice.", ingredients: "Espresso, Milk, Ice" },
    { name: "Fresh Orange Juice", cat: "Drinks", price: 6.0, popular: false, image: "photo-1600271886742-f049cd451bba", desc: "Cold pressed seasonal oranges.", ingredients: "Orange, Ice" },
    { name: "Sparkling Water", cat: "Drinks", price: 4.0, popular: false, image: "photo-1544145945-f90425340c7e", desc: "Imported Italian sparkling water with lime.", ingredients: "Mineral water, Lime" },
    { name: "Craft Lemonade", cat: "Drinks", price: 5.0, popular: false, image: "photo-1523677011781-c91d1bbe2f9e", desc: "House-made with fresh lemons and mint.", ingredients: "Lemon, Mint, Sugar, Water" },
  ];

  for (const m of menu) {
    const existing = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name: m.name },
    });
    if (!existing) {
      await prisma.menuItem.create({
        data: {
          name: m.name,
          description: m.desc,
          ingredients: m.ingredients,
          price: m.price,
          imageUrl: img(m.image),
          available: true,
          isPopular: m.popular,
          categoryId: catIds[m.cat],
          restaurantId: restaurant.id,
        },
      });
    }
  }

  const waiters = await prisma.user.findMany({
    where: { restaurantId: restaurant.id, role: "WAITER" },
  });

  for (let n = 1; n <= 8; n++) {
    const existing = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: n } },
    });
    if (!existing) {
      await prisma.table.create({
        data: {
          number: n,
          status: "free",
          restaurantId: restaurant.id,
          waiterId: waiters[n % waiters.length]?.id ?? waiters[0]?.id,
          code: `GF-${n}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("Logins:");
  console.log("  0982101908        / owner123 (owner)");
  console.log("  09171234568       / manager123");
  console.log("  09171234569       / waiter123");
  console.log("  09171234571       / kitchen123");
  console.log("  09171234573       / cashier123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
