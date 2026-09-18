import type { FastifyInstance } from "fastify";
import { clearSessionCookie, getSessionData, setSessionCookie } from "../lib/session.js";
import { loadConfig } from "../lib/config.js";
import { verifyPassword } from "../lib/passwords.js";
import { passwordPolicyError } from "../lib/passwordPolicy.js";
import { buildUserBackup, previewBackupJson, restoreUserBackup } from "../services/backup.js";
import {
  decryptBackupJson,
  encryptBackupJson,
  EncryptedBackupError,
  EncryptedBackupPassphraseError,
  isPotentialEncryptedBackup,
  maximumEncryptedBackupEnvelopeBytes,
  maximumEncryptedBackupPlaintextBytes
} from "../services/encryptedBackup.js";
import { findUserByEmail, findUserById, requireCurrentUser, updateUserPassword } from "../services/users.js";
import { field, formBody } from "./form.js";
import {
  createRestorePayloadToken,
  decodeRestorePayload,
  encodeRestorePayload,
  isRestorePayloadTokenValid
} from "../lib/restorePayload.js";

// A real bcrypt hash keeps unknown-email logins on the same expensive code path
// as known accounts without exposing whether an address exists.
const dummyPasswordHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.5YFPo6Vx3SvoEvqf1Ewi5tS7vN8Bvfe";
const config = loadConfig();

type RestoreInput = {
  payload: string;
  isEncrypted: boolean;
  backupJson: string;
};

function backupPayloadFromRequest(body: unknown): string {
  const form = formBody(body);
  const typedBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const uploadedBackup = typedBody.backupFile;
  const pastedBackup = field(form, "backupJson").trim();

  if (Buffer.isBuffer(uploadedBackup) && uploadedBackup.length > 0) {
    if (pastedBackup) {
      throw new Error("Choose either a backup file or pasted JSON.");
    }

    if (uploadedBackup.length > maximumEncryptedBackupEnvelopeBytes) {
      throw new Error("Backup file is too large.");
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(uploadedBackup);
    } catch {
      throw new Error("Backup file must be UTF-8 text.");
    }
  }

  if (pastedBackup.length > maximumEncryptedBackupPlaintextBytes) {
    throw new Error("Backup JSON is too large.");
  }

  return pastedBackup;
}

async function restoreInput(payload: string, passphrase: string): Promise<RestoreInput> {
  if (!payload) {
    throw new Error("Select a backup file or paste backup JSON.");
  }

  const isEncrypted = isPotentialEncryptedBackup(payload);
  const backupJson = isEncrypted ? await decryptBackupJson(payload, passphrase) : payload;

  if (Buffer.byteLength(backupJson, "utf8") > maximumEncryptedBackupPlaintextBytes) {
    throw new Error("Backup JSON is too large.");
  }

  return { payload, isEncrypted, backupJson };
}

function encryptedRestoreError(error: unknown): string {
  return error instanceof EncryptedBackupError
    ? "Encrypted backup could not be opened. Check the passphrase and file, then try again."
    : error instanceof Error
      ? error.message
      : "Could not preview backup.";
}

function knownEncryptedBackupFormError(error: unknown): string | null {
  if (error instanceof EncryptedBackupPassphraseError) {
    return error.message;
  }

  if (error instanceof EncryptedBackupError) {
    return "Encrypted backup could not be opened. Check the passphrase and file, then try again.";
  }

  return null;
}

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
      restoreError: null,
      usesTrustedPrivateHttp: config.transportSecurity === "trusted-private-http"
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
        restoreError: null,
        usesTrustedPrivateHttp: config.transportSecurity === "trusted-private-http"
      });
    }
  });

  app.post("/settings/restore/preview", {
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);

    try {
      const input = await restoreInput(backupPayloadFromRequest(request.body), field(body, "backupPassphrase"));
      const preview = previewBackupJson(input.backupJson);
      const serializedPreview = JSON.stringify(preview);

      return reply.view("settings/restore-preview.ejs", {
        title: "Restore preview",
        preview,
        backupPayloadBase64: encodeRestorePayload(input.payload),
        restorePreviewBase64: encodeRestorePayload(serializedPreview),
        restoreToken: createRestorePayloadToken(config.sessionSecret, user.id, input.payload, serializedPreview),
        isEncryptedBackup: input.isEncrypted,
        error: null
      });
    } catch (error) {
      return reply.code(400).view("settings/security.ejs", {
        title: "Security",
        user,
        error: null,
        success: null,
        passwordChangeRequired: user.mustChangePassword,
        restoreError: encryptedRestoreError(error),
        usesTrustedPrivateHttp: config.transportSecurity === "trusted-private-http"
      });
    }
  });

  app.post("/settings/restore/confirm", {
    bodyLimit: 20 * 1024 * 1024,
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const body = formBody(request.body);
    const encodedBackupPayload = field(body, "backupPayloadBase64");
    const encodedRestorePreview = field(body, "restorePreviewBase64");
    const restoreToken = field(body, "restoreToken");
    const confirmation = field(body, "confirmation").trim();
    let backupPayload = "";
    let preview: ReturnType<typeof previewBackupJson> | null = null;

    try {
      if (confirmation !== "RESTORE") {
        throw new Error("Type RESTORE to confirm.");
      }

      const user = await requireCurrentUser(request);
      backupPayload = decodeRestorePayload(encodedBackupPayload, maximumEncryptedBackupEnvelopeBytes);
      const serializedPreview = decodeRestorePayload(encodedRestorePreview, 64 * 1024);

      if (!isRestorePayloadTokenValid(config.sessionSecret, user.id, backupPayload, restoreToken, serializedPreview)) {
        throw new Error("Restore preview has expired or changed. Preview the backup again.");
      }

      preview = JSON.parse(serializedPreview) as ReturnType<typeof previewBackupJson>;

      const input = await restoreInput(backupPayload, field(body, "backupPassphrase"));
      preview = previewBackupJson(input.backupJson);
      const restoredPreview = await restoreUserBackup(user.id, input.backupJson);

      return reply.view("settings/restore-complete.ejs", {
        title: "Restore complete",
        preview: restoredPreview
      });
    } catch (error) {
      return reply.code(400).view("settings/restore-preview.ejs", {
        title: "Restore preview",
        preview,
        backupPayloadBase64: encodedBackupPayload,
        restorePreviewBase64: encodedRestorePreview,
        restoreToken,
        isEncryptedBackup: isPotentialEncryptedBackup(backupPayload),
        error: encryptedRestoreError(error)
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

  app.post("/settings/backup.pwb", {
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    const passphrase = field(body, "backupPassphrase");

    if (passphrase !== field(body, "backupPassphraseConfirmation")) {
      return reply.code(400).view("settings/security.ejs", {
        title: "Security",
        user,
        error: null,
        success: null,
        passwordChangeRequired: user.mustChangePassword,
        restoreError: "Encrypted backup passphrases do not match.",
        usesTrustedPrivateHttp: config.transportSecurity === "trusted-private-http"
      });
    }

    try {
      const backup = await buildUserBackup(user.id);
      const encryptedBackup = await encryptBackupJson(JSON.stringify(backup), passphrase);
      const date = new Date().toISOString().slice(0, 10);

      return reply
        .header("Cache-Control", "no-store")
        .header("Content-Type", "application/vnd.pennyworth.encrypted-backup; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="pennyworth-backup-${date}.pwb"`)
        .send(encryptedBackup);
    } catch (error) {
      const formError = knownEncryptedBackupFormError(error);

      if (!formError) {
        throw error;
      }

      return reply.code(400).view("settings/security.ejs", {
        title: "Security",
        user,
        error: null,
        success: null,
        passwordChangeRequired: user.mustChangePassword,
        restoreError: formError,
        usesTrustedPrivateHttp: config.transportSecurity === "trusted-private-http"
      });
    }
  });
}
