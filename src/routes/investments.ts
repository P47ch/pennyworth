import type { FastifyInstance } from "fastify";
import { getInvestmentReport } from "../services/investmentSummary.js";
import { requireCurrentUser } from "../services/users.js";

export async function investmentRoutes(app: FastifyInstance) {
  app.get("/investments", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const report = await getInvestmentReport(user.id);

    return reply.view("investments/index.ejs", {
      title: "Investments",
      report,
      formatPercent: (value: number) => `${Math.round(value * 100)}%`
    });
  });
}
