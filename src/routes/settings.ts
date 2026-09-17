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
import { field, fields, formBody } from "./form.js";

export async function settingsRoutes(app: FastifyInstance) {
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
