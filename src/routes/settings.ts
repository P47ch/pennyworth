import type { FastifyInstance } from "fastify";
import { avatarChoices, isAvatarKey } from "../lib/avatar.js";
import {
  isLanguage,
  isMenuItemId,
  isTheme,
  menuItemIds,
  normalizeUserPreferences
} from "../lib/preferences.js";
import { requireCurrentUser, updateUserPreferences } from "../services/users.js";
import { requireAdministrator } from "../services/managedUsers.js";
import type { UpdateCheckService } from "../services/updateCheck.js";
import { field, fields, formBody } from "./form.js";

type SettingsRouteOptions = {
  updateCheckService: UpdateCheckService;
  timeZone: string;
};

function formatDate(value: Date | undefined, language: "en" | "it", timeZone: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return new Intl.DateTimeFormat(language === "it" ? "it-IT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(value);
}

export async function settingsRoutes(app: FastifyInstance, options: SettingsRouteOptions) {
  app.get("/settings/application", async (request, reply) => {
    const administrator = await requireAdministrator(request);
    const preferences = normalizeUserPreferences(administrator);
    const state = options.updateCheckService.getState();
    const checkedAt =
      state.status === "current" || state.status === "available" || state.status === "stale" ? state.checkedAt : undefined;
    const lastAttemptAt = state.status === "unavailable" || state.status === "stale" ? state.lastAttemptAt : undefined;
    const release = state.status === "available" || state.status === "stale" ? state.release : undefined;

    return reply.view("settings/application.ejs", {
      title: "Application",
      updateState: state.status,
      updateChannel: app.config.updateChannel,
      installedVersion: app.config.installedVersion,
      checkedAt: formatDate(checkedAt, preferences.language, options.timeZone),
      lastAttemptAt: formatDate(lastAttemptAt, preferences.language, options.timeZone),
      release: release
        ? {
            ...release,
            publishedAt: formatDate(release.publishedAt, preferences.language, options.timeZone)
          }
        : undefined
    });
  });

  app.get("/settings/preferences", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const query = request.query as Record<string, string | undefined>;

    return reply.view("settings/preferences.ejs", {
      title: "Preferences",
      preferences: normalizeUserPreferences(user),
      avatarChoices: avatarChoices(user),
      error: null,
      success: query.saved === "1" ? "Preferences updated." : null
    });
  });

  app.post("/settings/preferences", async (request, reply) => {
    const user = await requireCurrentUser(request);
    const body = formBody(request.body);
    const language = field(body, "language");
    const theme = field(body, "theme");
    const avatarKey = field(body, "avatarKey");
    const visibleMenuItems = fields(body, "visibleMenuItems");

    try {
      if (!isLanguage(language)) {
        throw new Error("Unsupported language.");
      }

      if (!isTheme(theme)) {
        throw new Error("Unsupported theme.");
      }

      if (!isAvatarKey(avatarKey)) {
        throw new Error("Unsupported avatar.");
      }

      if (visibleMenuItems.some((item) => !isMenuItemId(item))) {
        throw new Error("Unsupported menu item.");
      }

      await updateUserPreferences(user.id, {
        language,
        theme,
        avatarKey,
        hiddenMenuItems: menuItemIds.filter((item) => !visibleMenuItems.includes(item))
      });

      return reply.redirect("/settings/preferences?saved=1");
    } catch (error) {
      return reply.code(400).view("settings/preferences.ejs", {
        title: "Preferences",
        preferences: normalizeUserPreferences({
          language,
          theme,
          avatarKey,
          hiddenMenuItems: menuItemIds.filter((item) => !visibleMenuItems.includes(item))
        }),
        avatarChoices: avatarChoices(user),
        error: error instanceof Error ? error.message : "Could not update preferences.",
        success: null
      });
    }
  });
}
