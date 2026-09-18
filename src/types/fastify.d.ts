import type { User } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    currentUser: User | null;
  }

  interface FastifyInstance {
    config: {
      updateChannel: "stable" | "prerelease";
      installedVersion: string;
    };
  }
}
