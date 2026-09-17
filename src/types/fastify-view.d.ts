import "fastify";

declare module "fastify" {
  interface FastifyReply {
    locals?: {
      csrfToken?: string;
      [key: string]: unknown;
    };
  }
}
