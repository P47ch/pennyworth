import type { FastifyInstance } from "fastify";
import { clearSessionCookie, getSessionData, setSessionCookie } from "../lib/session.js";
import { loadConfig } from "../lib/config.js";
import { verifyPassword } from "../lib/passwords.js";
import { passwordPolicyError } from "../lib/passwordPolicy.js";
import { buildUserBackup, previewBackupJson, restoreUserBackup } from "../services/backup.js";
import { findUserByEmail, findUserById, requireCurrentUser, updateUserPassword } from "../services/users.js";
import { field, formBody } from "./form.js";

// A real bcrypt hash keeps unknown-email logins on the same expensive code path
// as known accounts without exposing whether an address exists.
const dummyPasswordHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5YFPo6Vx3SvoEvqf1Ewi5tS7vN8Bvfe";
const config = loadConfig();

export async function authRoutes(app: FastifyInstance) {
  app.get("/login", async (request, reply) => {
    const session = getSessionData(request);
    const user = session ? await findUserById(session.userId) : null;

    if (user?.isActive && user.sessionVersion === session?.sessionVersion) {
      return reply.redirect(user.mustChangePassword ? "/settings/security?required=1" : "/");
    }

    if (session) {
      clearSessionCookie(reply);
    }

    return reply.view("auth/login.ejs", {
      title: "Login",
      hideNav: true,
      error: null
    });
  });

  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 8,
          timeWindow: "15 minutes"
        }
      }
    },
    async (request, reply) => {
      const body = formBody(request.body);
      const email = field(body, "email").trim().toLowerCase();
      const password = field(body, "password");
      const user = email ? await findUserByEmail(email) : null;
      const validPassword = await verifyPassword(password, user?.passwordHash ?? dummyPasswordHash);

      if (!user || !user.isActive || !validPassword) {
        return reply.code(401).view("auth/login.ejs", {
          title: "Login",
          hideNav: true,
          error: "Invalid email or password."
        });
      }

      setSessionCookie(reply, user.id, user.sessionVersion, config.secureCookies);
      return reply.redirect(user.mustChangePassword ? "/settings/security?required=1" : "/");
    }
  );

  app.post("/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.redirect("/login");
  });

  app.get("/settings/security", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const query = request.query as Record<string, string | undefined>;

    return reply.view("settings/security.ejs", {
      title: "Security",
      user,
      error: null,
      success: query.passwordUpdated === "1" ? "Password updated." : null,
      passwordChangeRequired: user.mustChangePassword || query.required === "1",
      restoreError: null
    });
  });

  app.post("/settings/security/password", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    const currentPassword = field(body, "currentPassword");
    const newPassword = field(body, "newPassword");
    const confirmPassword = field(body, "confirmPassword");

    try {
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new Error("Current password is incorrect.");
      }

      const policyError = passwordPolicyError(newPassword, "New password");

      if (policyError) {
        throw new Error(policyError);
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match.");
      }

      const updatedUser = await updateUserPassword(user.id, newPassword);
      setSessionCookie(reply, updatedUser.id, updatedUser.sessionVersion, config.secureCookies);
      return reply.redirect("/settings/security?passwordUpdated=1");
    } catch (error) {
      return reply.code(400).view("settings/security.ejs", {
        title: "Security",
        user,
        error: error instanceof Error ? error.message : "Could not update password.",
        success: null,
        passwordChangeRequired: user.mustChangePassword,
        restoreError: null
      });
    }
  });

  app.post("/settings/restore/preview", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    const backupJson = field(body, "backupJson").trim();

    try {
      const preview = previewBackupJson(backupJson);

      return reply.view("settings/restore-preview.ejs", {
        title: "Restore preview",
        preview,
        backupJson,
        error: null
      });
    } catch (error) {
      return reply.code(400).view("settings/security.ejs", {
        title: "Security",
        user,
        error: null,
        success: null,
        passwordChangeRequired: user.mustChangePassword,
        restoreError: error instanceof Error ? error.message : "Could not preview backup."
      });
    }
  });

  app.post("/settings/restore/confirm", async (request, reply) => {
    const body = formBody(request.body);
    const backupJson = field(body, "backupJson");
    const confirmation = field(body, "confirmation").trim();

    try {
      if (confirmation !== "RESTORE") {
        throw new Error("Type RESTORE to confirm.");
      }

      const user = await requireCurrentUser(request);
      const preview = await restoreUserBackup(user.id, backupJson);

      return reply.view("settings/restore-complete.ejs", {
        title: "Restore complete",
        preview
      });
    } catch (error) {
      let preview = null;

      try {
        preview = previewBackupJson(backupJson);
      } catch {
        // Keep the original restore error when both confirmation and preview fail.
      }

      return reply.code(400).view("settings/restore-preview.ejs", {
        title: "Restore preview",
        preview,
        backupJson,
        error: error instanceof Error ? error.message : "Could not restore backup."
      });
    }
  });

  app.get("/settings/backup.json", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const backup = await buildUserBackup(user.id);
    const date = new Date().toISOString().slice(0, 10);

    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="pennyworth-backup-${date}.json"`)
      .send(JSON.stringify(backup, null, 2));
  });
}
