import { PrismaClient } from "@prisma/client";

// Single shared client; `globalThis` caching prevents Next.js dev-server
// hot reloads from exhausting the connection pool with new clients.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}