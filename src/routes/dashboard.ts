import type { FastifyInstance } from "fastify";
import { getDashboardSummary } from "../services/dashboard.js";
import { requireCurrentUser } from "../services/users.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const summary = await getDashboardSummary(user.id);

    return reply.view("dashboard.ejs", {
      title: "Dashboard",
      summary,
    });
  });
}
