import type { FastifyInstance } from "fastify";
import { getStatistics } from "../services/statistics.js";
import { requireCurrentUser } from "../services/users.js";

export async function statisticsRoutes(app: FastifyInstance) {
  app.get("/statistics", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const statistics = await getStatistics(user.id, user.language === "it" ? "it-IT" : "en-US");

    return reply.view("statistics/index.ejs", {
      title: "Statistics",
      statistics,
      formatPercent: (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`)
    });
  });
}
