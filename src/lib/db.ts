import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  queryCount?: number;
};

const countQueries = process.env.PERF_QUERY_COUNT === "true";
const prismaOptions: Prisma.PrismaClientOptions = {
  log: countQueries
    ? [{ emit: "event", level: "query" }, "error"]
    : process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"]
};
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions);

globalForPrisma.queryCount ??= 0;

if (countQueries && !globalForPrisma.prisma) {
  const onQuery = prisma.$on.bind(prisma) as unknown as (
    event: "query",
    listener: (event: { query: string }) => void
  ) => void;
  onQuery("query", () => {
    globalForPrisma.queryCount = (globalForPrisma.queryCount ?? 0) + 1;
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function resetQueryCount() {
  globalForPrisma.queryCount = 0;
}

export function getQueryCount() {
  return globalForPrisma.queryCount ?? 0;
}
