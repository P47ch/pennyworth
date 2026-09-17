import type { FastifyInstance } from "fastify";
import {
  createManagedUser,
  listManagedUsers,
  requireAdministrator,
  resetManagedUserPassword,
  setManagedUserActiveState
} from "../services/managedUsers.js";
import { field, formBody } from "./form.js";

async function usersPageModel(administratorId: string) {
  return {
    title: "Users",
    users: await listManagedUsers(administratorId),
    error: null,
    temporaryCredential: null,
    form: { name: "", email: "" }
  };
}

export async function managedUserRoutes(app: FastifyInstance) {
  app.get("/settings/users", async (request, reply) => {
    const administrator = await requireAdministrator(request);
    return reply.view("settings/users.ejs", await usersPageModel(administrator.id));
  });

  app.post("/settings/users", async (request, reply) => {
    const administrator = await requireAdministrator(request);
    const body = formBody(request.body);
    const form = {
      name: field(body, "name"),
      email: field(body, "email")
    };

    try {
      const temporaryCredential = await createManagedUser(administrator.id, form);

      return reply.code(201).view("settings/users.ejs", {
        ...(await usersPageModel(administrator.id)),
        temporaryCredential
      });
    } catch (error) {
      return reply.code(400).view("settings/users.ejs", {
        ...(await usersPageModel(administrator.id)),
        error: error instanceof Error ? error.message : "Could not create user.",
        form
      });
    }
  });

  app.post("/settings/users/:userId/active", async (request, reply) => {
    const administrator = await requireAdministrator(request);
    const { userId } = request.params as { userId: string };
    const body = formBody(request.body);

    try {
      const activeValue = field(body, "isActive");

      if (activeValue !== "true" && activeValue !== "false") {
        throw new Error("Choose a valid user status.");
      }

      await setManagedUserActiveState(administrator.id, userId, activeValue === "true");
      return reply.redirect("/settings/users");
    } catch (error) {
      return reply.code(400).view("settings/users.ejs", {
        ...(await usersPageModel(administrator.id)),
        error: error instanceof Error ? error.message : "Could not update user.",
        form: { name: "", email: "" }
      });
    }
  });

  app.post("/settings/users/:userId/reset-password", async (request, reply) => {
    const administrator = await requireAdministrator(request);
    const { userId } = request.params as { userId: string };

    try {
      const temporaryCredential = await resetManagedUserPassword(administrator.id, userId);

      return reply.view("settings/users.ejs", {
        ...(await usersPageModel(administrator.id)),
        temporaryCredential
      });
    } catch (error) {
      return reply.code(400).view("settings/users.ejs", {
        ...(await usersPageModel(administrator.id)),
        error: error instanceof Error ? error.message : "Could not reset password.",
        form: { name: "", email: "" }
      });
    }
  });
}
