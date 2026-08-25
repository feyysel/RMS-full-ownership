import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  adapter?: PrismaPg;
};

const adapter =
  globalForPrisma.adapter ??
  new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });

const logConfig =
  process.env.NODE_ENV === "production"
    ? ["error" as const]
    : ["warn" as const, "error" as const];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: logConfig,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.adapter = adapter;
  globalForPrisma.prisma = prisma;
}
