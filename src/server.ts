import path from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import view from "@fastify/view";
import ejs from "ejs";
import Fastify from "fastify";
import { accountRoutes } from "./routes/accounts.js";
import { createMoneyFormatter } from "./finance/money.js";
import { assetPriceRoutes } from "./routes/assetPrices.js";
import { assetRoutes } from "./routes/assets.js";
import { authRoutes } from "./routes/auth.js";
import { budgetRoutes } from "./routes/budgets.js";
import { categoryRoutes } from "./routes/categories.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { holdingRoutes } from "./routes/holdings.js";
import { investmentTransactionRoutes } from "./routes/investmentTransactions.js";
import { investmentRoutes } from "./routes/investments.js";
import { recurringRoutes } from "./routes/recurring.js";
import { ruleRoutes } from "./routes/rules.js";
import { statisticsRoutes } from "./routes/statistics.js";
import { settingsRoutes } from "./routes/settings.js";
import { managedUserRoutes } from "./routes/managedUsers.js";
import { tagRoutes } from "./routes/tags.js";
import { transactionRoutes } from "./routes/transactions.js";
import { loadConfig } from "./lib/config.js";
import { getOrCreateCsrfToken, validateCsrfToken } from "./lib/csrf.js";
import { todayDateInput } from "./lib/dates.js";
import { prisma } from "./lib/db.js";
import { createTranslator } from "./lib/i18n.js";
import { renderCategoryIcon, renderCategoryLabel, renderColorSwatch, renderIcon } from "./lib/icons.js";
import { errorPageModel } from "./lib/httpErrors.js";
import { localizeEjsTemplate } from "./lib/localizedEjs.js";
import { defaultUserPreferences, languages, menuGroups, normalizeUserPreferences, themes } from "./lib/preferences.js";
import { resolveAvatar } from "./lib/avatar.js";
import { clearSessionCookie, getSessionData, refreshSessionCookie } from "./lib/session.js";
import { applicationVersion } from "./lib/version.js";

const projectRoot = process.cwd();
const config = loadConfig();
const localizedEjs = {
  ...ejs,
  compile(template: string, options: ejs.Options) {
    return ejs.compile(localizeEjsTemplate(template), options);
  }
};

export async function buildApp() {
  const app = Fastify({
    bodyLimit: 10 * 1024 * 1024,
    logger: {
      level: config.isProduction ? "info" : "warn"
    }
  });

  app.decorateRequest("currentUser", null);

  await app.register(cookie, {
    secret: config.sessionSecret
  });
  await app.register(rateLimit, {
    global: false
  });
  await app.register(formbody);
  await app.register(staticFiles, {
    root: path.join(projectRoot, "src", "public"),
    prefix: "/public/"
  });
  await app.register(staticFiles, {
    root: path.join(projectRoot, "node_modules", "chart.js", "dist"),
    prefix: "/vendor/chartjs/",
    decorateReply: false
  });
  await app.register(view, {
    engine: { ejs: localizedEjs },
    root: path.join(projectRoot, "src", "views"),
    layout: "layout.ejs"
  });

  function renderErrorPage(reply: Parameters<Parameters<typeof app.setErrorHandler>[0]>[2], model: ReturnType<typeof errorPageModel>) {
    const fallbackPreferences = defaultUserPreferences;

    return reply.code(model.statusCode).view("error.ejs", {
      ...model,
      appVersion: applicationVersion,
      hideNav: true,
      csrfToken: "",
      currentPath: "",
      categoryIcon: renderCategoryIcon,
      categoryLabel: renderCategoryLabel,
      colorSwatch: renderColorSwatch,
      icon: renderIcon,
      menuGroups,
      t: createTranslator(fallbackPreferences.language),
      userPreferences: fallbackPreferences
    });
  }

  app.setNotFoundHandler(async (request, reply) => {
    return renderErrorPage(reply, errorPageModel({ statusCode: 404 }, request.id));
  });

  app.setErrorHandler(async (error, request, reply) => {
    const model = errorPageModel(error, request.id);

    if (model.statusCode >= 500) {
      request.log.error({ err: error }, "Unhandled request error");
    }

    return renderErrorPage(reply, model);
  });

  app.get("/healthz", async () => ({ ok: true }));
  app.get("/readyz", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false });
    }
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'none'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'"
      ].join("; ")
    );
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (!request.url.startsWith("/public/") && !request.url.startsWith("/vendor/")) {
      reply.header("Cache-Control", "no-store");
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    const url = request.url;

    if (url.startsWith("/public/") || url.startsWith("/vendor/") || url === "/healthz" || url === "/readyz") {
      return;
    }

    const csrfToken = getOrCreateCsrfToken(request, reply, config.secureCookies);
    reply.locals = {
      ...(reply.locals ?? {}),
      csrfToken,
      appVersion: applicationVersion,
      currentPath: url.split("?")[0],
      todayInputValue: todayDateInput(config.timeZone),
      primaryCurrency: config.primaryCurrency,
      formatMoney: createMoneyFormatter(config.primaryCurrency),
      categoryIcon: renderCategoryIcon,
      categoryLabel: renderCategoryLabel,
      colorSwatch: renderColorSwatch,
      icon: renderIcon,
      languages,
      menuGroups,
      themes,
      t: createTranslator(defaultUserPreferences.language),
      userPreferences: defaultUserPreferences
    };

    if (request.method === "POST" && !validateCsrfToken(request)) {
      return reply.code(403).send("Invalid CSRF token.");
    }

    if (url.startsWith("/login")) {
      return;
    }

    const session = getSessionData(request);

    if (!session) {
      return reply.redirect("/login");
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });

    if (!user || !user.isActive || user.sessionVersion !== session.sessionVersion) {
      clearSessionCookie(reply);
      return reply.redirect("/login");
    }

    const currentPath = url.split("?")[0];

    if (config.secureCookies && currentPath !== "/logout") {
      refreshSessionCookie(reply, session, true);
    }

    request.currentUser = user;

    const canChangeRequiredPassword =
      currentPath === "/settings/security" ||
      currentPath === "/settings/security/password" ||
      currentPath === "/logout";

    if (user.mustChangePassword && !canChangeRequiredPassword) {
      return reply.redirect("/settings/security?required=1");
    }

    const userPreferences = normalizeUserPreferences(user);
    reply.locals = {
      ...reply.locals,
      currentUser: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        avatar: resolveAvatar(user)
      },
      t: createTranslator(userPreferences.language),
      userPreferences
    };
  });

  await app.register(authRoutes);
  await app.register(settingsRoutes);
  await app.register(managedUserRoutes);
  await app.register(dashboardRoutes);
  await app.register(statisticsRoutes);
  await app.register(budgetRoutes);
  await app.register(recurringRoutes);
  await app.register(accountRoutes);
  await app.register(assetRoutes);
  await app.register(investmentRoutes);
  await app.register(assetPriceRoutes);
  await app.register(holdingRoutes);
  await app.register(investmentTransactionRoutes);
  await app.register(categoryRoutes);
  await app.register(tagRoutes);
  await app.register(ruleRoutes);
  await app.register(transactionRoutes);

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Pennyworth v${applicationVersion} listening on http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}
