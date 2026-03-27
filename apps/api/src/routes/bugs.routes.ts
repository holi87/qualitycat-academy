import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { sendError } from "../lib/errors.js";
import { getBugFlagsSnapshot, getRuntimeBugSnapshot } from "../lib/bugs.js";
import { isAdminOrMentor } from "../types/shared.js";

const bugsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/__debug/flags",
    {
      schema: {
        tags: ["bugs"],
        summary: "Read runtime bug flags",
        description: "Runtime bug mode snapshot.",
      },
    },
    async () => {
      return getBugFlagsSnapshot();
    },
  );

  app.get(
    "/bugs/public-state",
    {
      schema: {
        tags: ["bugs"],
        summary: "Public runtime bug state",
        description: "Public endpoint used by web UI to apply frontend bug mode without restart.",
      },
    },
    async () => {
      const snapshot = getRuntimeBugSnapshot();
      return {
        data: {
          backendBugs: snapshot.backendBugs,
          frontendBugs: snapshot.frontendBugs,
          frontendFlags: snapshot.frontendFlags,
        },
      };
    },
  );

  app.get(
    "/internal/bugs",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["bugs"],
        summary: "Bug flags snapshot",
        description: "Accessible for admin and mentor.",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!isAdminOrMentor(request.user.role)) {
        return sendError(reply, 403, "FORBIDDEN", "Mentor or admin role required");
      }

      return {
        data: getRuntimeBugSnapshot(),
      };
    },
  );
};

export default bugsRoutes;
