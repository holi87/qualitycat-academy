import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../lib/errors.js";
import { setAllBackendFlags, setAllFrontendFlags, setRuntimeBugState } from "../lib/bugs.js";
import { resetAcademyToBaseline } from "../lib/baseline.js";
import type { BugFlagMap } from "../lib/bugs.js";

type AdminRoutesOptions = {
  prisma: PrismaClient;
};

const DB_RESET_CONFIRMATION_VALUE = "RESET";

const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app: FastifyInstance, opts) => {
  const { prisma } = opts;

  app.put<{
    Body: {
      backendBugs?: boolean;
      frontendBugs?: boolean;
      flags?: Record<string, boolean>;
      frontendFlags?: Record<string, boolean>;
    };
  }>(
    "/bugs/state",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["admin", "bugs"],
        summary: "Update runtime bug state",
        description: "Admin-only runtime toggle for backend/frontend bug mode and individual bug flags.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            backendBugs: { type: "boolean" },
            frontendBugs: { type: "boolean" },
            flags: {
              type: "object",
              additionalProperties: { type: "boolean" },
            },
            frontendFlags: {
              type: "object",
              additionalProperties: { type: "boolean" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.user.role !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only admin can update bug flags");
      }

      if (request.body.backendBugs === true && request.body.flags === undefined) {
        setAllBackendFlags(true);
      }

      if (request.body.frontendBugs === true && request.body.frontendFlags === undefined) {
        setAllFrontendFlags(true);
      }

      const snapshot = setRuntimeBugState({
        backendBugs: request.body.backendBugs,
        frontendBugs: request.body.frontendBugs,
        flags: request.body.flags as BugFlagMap | undefined,
        frontendFlags: request.body.frontendFlags as BugFlagMap | undefined,
      });

      request.log.warn(
        {
          action: "runtime.bugs.update",
          triggeredBy: {
            userId: request.user.userId,
            email: request.user.email,
          },
          update: request.body,
          snapshot,
        },
        "Runtime bug state updated by admin endpoint.",
      );

      return {
        data: snapshot,
      };
    },
  );

  app.post<{ Body: { confirmation: string } }>(
    "/reset-database",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["admin"],
        summary: "Reset database to baseline",
        description:
          "Admin-only operation. Confirmation value must equal 'RESET'. Existing users/sessions/bookings are replaced with baseline seed data.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["confirmation"],
          additionalProperties: false,
          properties: {
            confirmation: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.user.role !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Only admin can reset database");
      }

      if (request.body.confirmation.trim().toUpperCase() !== DB_RESET_CONFIRMATION_VALUE) {
        return sendError(
          reply,
          400,
          "INVALID_CONFIRMATION",
          `Confirmation must be '${DB_RESET_CONFIRMATION_VALUE}'`,
        );
      }

      const summary = await resetAcademyToBaseline(prisma);
      request.log.warn(
        {
          action: "database.reset",
          triggeredBy: {
            userId: request.user.userId,
            email: request.user.email,
          },
          summary,
        },
        "Database reset executed by admin endpoint.",
      );

      return {
        data: {
          status: "ok",
          summary,
        },
      };
    },
  );
};

export default adminRoutes;
