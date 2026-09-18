import { chromium } from "@playwright/test";
import axe from "axe-core";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const email = process.env.AUDIT_EMAIL ?? "admin@example.com";
const password = process.env.AUDIT_PASSWORD ?? "change-me-now";
const ignoreHTTPSErrors = process.env.AUDIT_IGNORE_HTTPS_ERRORS === "true";

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const routes = [
  "/",
  "/statistics",
  "/budgets",
  "/recurring",
  "/accounts",
  "/investments",
  "/assets",
  "/holdings",
  "/investment-transactions",
  "/asset-prices",
  "/transactions",
  "/transactions/import",
  "/categories",
  "/tags",
  "/rules",
  "/settings/application",
  "/settings/security"
];

function summarizeAxeViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.map((node) => node.target.join(" "))
  }));
}

async function assertNoVisibleHorizontalOverflow(page) {
  return page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;

    if (documentWidth <= viewportWidth + 1) {
      return [];
    }

    return Array.from(document.body.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          id: element.id,
          left: rect.left,
          right: rect.right,
          width: rect.width
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
      .slice(0, 20);
  });
}

async function runAxe(page) {
  return page.evaluate(async (source) => {
    const runner = new Function(`${source}; return axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
      }
    });`);
    return runner();
  }, axe.source);
}

async function main() {
  const browser = await chromium.launch();
  const failures = [];
  const pageResults = [];

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, ignoreHTTPSErrors });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
    });

    const loginResponse = await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    const csp = loginResponse?.headers()["content-security-policy"] ?? "";

    if (!csp.includes("script-src 'self'") || !csp.includes("style-src 'self'")) {
      failures.push(`${viewport.name}: missing strict script/style CSP on /login`);
    }

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await Promise.all([page.waitForURL(`${baseUrl}/`), page.getByRole("button", { name: "Sign in" }).click()]);

    if (baseUrl.startsWith("https://")) {
      const cookies = await context.cookies(baseUrl);
      const sessionCookie = cookies.find((cookie) => cookie.name === "pennyworth_session");

      if (!sessionCookie) {
        failures.push(`${viewport.name}: authenticated session cookie is missing`);
      } else {
        if (!sessionCookie.httpOnly) {
          failures.push(`${viewport.name}: authenticated session cookie is not HttpOnly`);
        }

        if (!sessionCookie.secure) {
          failures.push(`${viewport.name}: authenticated session cookie is not Secure`);
        }

        if (sessionCookie.sameSite !== "Strict") {
          failures.push(`${viewport.name}: authenticated session cookie is not SameSite=Strict`);
        }
      }
    }

    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });

      if (!response || !response.ok()) {
        failures.push(`${viewport.name} ${route}: response ${response?.status() ?? "missing"}`);
        continue;
      }

      const title = await page.title();
      const headings = await page.locator("h1").count();
      const axeResults = await runAxe(page);
      const overflow = await assertNoVisibleHorizontalOverflow(page);

      pageResults.push({
        viewport: viewport.name,
        route,
        title,
        headings,
        axeViolationCount: axeResults.violations.length,
        overflowCount: overflow.length
      });

      if (headings !== 1) {
        failures.push(`${viewport.name} ${route}: expected one h1, found ${headings}`);
      }

      if (axeResults.violations.length > 0) {
        failures.push(
          `${viewport.name} ${route}: axe violations ${JSON.stringify(summarizeAxeViolations(axeResults.violations), null, 2)}`
        );
      }

      if (overflow.length > 0) {
        failures.push(`${viewport.name} ${route}: horizontal overflow ${JSON.stringify(overflow, null, 2)}`);
      }
    }

    if (consoleErrors.length > 0) {
      failures.push(`${viewport.name}: console errors ${JSON.stringify(consoleErrors, null, 2)}`);
    }

    if (pageErrors.length > 0) {
      failures.push(`${viewport.name}: page errors ${JSON.stringify(pageErrors, null, 2)}`);
    }

    const realFailedRequests = failedRequests.filter((request) => !request.includes("/favicon.ico"));

    if (realFailedRequests.length > 0) {
      failures.push(`${viewport.name}: failed requests ${JSON.stringify(realFailedRequests, null, 2)}`);
    }

    await context.close();
  }

  await browser.close();

  console.log(JSON.stringify({ baseUrl, ignoreHTTPSErrors, pageResults, failures }, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
