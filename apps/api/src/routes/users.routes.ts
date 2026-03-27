import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { sendError } from "../lib/errors.js";
import { getPaginationSkip, buildPaginationMeta } from "../lib/pagination.js";
import { isAdminOrMentor, toRole } from "../types/shared.js";
import type { SortOrder } from "../types/shared.js";

type UserSortBy = "email" | "role" | "createdAt";

type UsersRoutesOptions = {
  prisma: PrismaClient;
};

const userSelectWithoutPassword = {
  id: true,
  email: true,
  role: true,
  name: true,
  bio: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

const usersRoutes: FastifyPluginAsync<UsersRoutesOptions> = async (app: FastifyInstance, opts) => {
  const { prisma } = opts;

  // ─── GET / ── Admin: list all users (paginated, sortable, filterable) ─

  app.get<{
    Querystring: {
      page: number;
      limit: number;
      sortBy: UserSortBy;
      sortOrder: SortOrder;
      role?: UserRole;
    };
  }>(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["users"],
        summary: "List users (admin)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            sortBy: { type: "string", enum: ["email", "role", "createdAt"], default: "createdAt" },
            sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
            role: { type: "string", enum: ["ADMIN", "MENTOR", "STUDENT"] },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.user.role !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Admin access required");
      }

      const { page, limit, sortBy, sortOrder, role } = request.query;
      const skip = getPaginationSkip(page, limit);

      const where: Prisma.UserWhereInput = {};
      if (role) {
        where.role = role;
      }

      const orderBy: Prisma.UserOrderByWithRelationInput =
        sortBy === "email"
          ? { email: sortOrder }
          : sortBy === "role"
            ? { role: sortOrder }
            : { createdAt: sortOrder };

      const [items, total] = await prisma.$transaction([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: userSelectWithoutPassword,
        }),
        prisma.user.count({ where }),
      ]);

      return {
        data: items,
        meta: {
          ...buildPaginationMeta(page, limit, total),
          sortBy,
          sortOrder,
          filters: {
            role: role ?? null,
          },
        },
      };
    },
  );

  // ─── GET /:id ── User profile (admin or self) ────────────────────────

  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["users"],
        summary: "Get user profile",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.user.role !== "admin" && request.params.id !== request.user.userId) {
        return sendError(reply, 403, "FORBIDDEN", "Not authorized to view this user");
      }

      const user = await prisma.user.findUnique({
        where: { id: request.params.id },
        select: userSelectWithoutPassword,
      });

      if (!user) {
        return sendError(reply, 404, "USER_NOT_FOUND", "User not found");
      }

      return { data: user };
    },
  );

  // ─── PATCH /:id ── Update user profile (self or admin) ───────────────

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      bio?: string;
      avatarUrl?: string;
      role?: UserRole;
    };
  }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["users"],
        summary: "Update user profile",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            bio: { type: "string", maxLength: 2000 },
            avatarUrl: { type: "string", minLength: 1, maxLength: 500 },
            role: { type: "string", enum: ["ADMIN", "MENTOR", "STUDENT"] },
          },
        },
      },
    },
    async (request, reply) => {
      const isSelf = request.params.id === request.user.userId;
      const isAdmin = request.user.role === "admin";

      if (!isAdmin && !isSelf) {
        return sendError(reply, 403, "FORBIDDEN", "Not authorized to update this user");
      }

      const existingUser = await prisma.user.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!existingUser) {
        return sendError(reply, 404, "USER_NOT_FOUND", "User not found");
      }

      // Non-admin users cannot update role
      if (!isAdmin && request.body.role) {
        return sendError(reply, 403, "FORBIDDEN", "Only admin can update role");
      }

      const data: Prisma.UserUpdateInput = {};

      if (request.body.name !== undefined) {
        data.name = request.body.name.trim() || null;
      }
      if (request.body.bio !== undefined) {
        data.bio = request.body.bio.trim() || null;
      }
      if (request.body.avatarUrl !== undefined) {
        data.avatarUrl = request.body.avatarUrl.trim() || null;
      }
      if (isAdmin && request.body.role !== undefined) {
        data.role = request.body.role;
      }

      const updated = await prisma.user.update({
        where: { id: request.params.id },
        data,
        select: userSelectWithoutPassword,
      });

      return reply.code(200).send({ data: updated });
    },
  );

  // ─── DELETE /:id ── Delete user (admin only, cannot delete self) ─────

  app.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["users"],
        summary: "Delete user (admin)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.user.role !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Admin access required");
      }

      if (request.params.id === request.user.userId) {
        return sendError(reply, 409, "CANNOT_DELETE_SELF", "Admin cannot delete own account");
      }

      const user = await prisma.user.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!user) {
        return sendError(reply, 404, "USER_NOT_FOUND", "User not found");
      }

      await prisma.user.delete({
        where: { id: user.id },
      });

      return reply.code(204).send();
    },
  );
};

export default usersRoutes;
