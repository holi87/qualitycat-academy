import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { sendError } from "../lib/errors.js";
import { getAuthFailureStatus } from "../lib/auth.js";
import { toRole } from "../types/shared.js";

type AuthRoutesOptions = {
  prisma: PrismaClient;
  jwtExpiresIn: string;
};

const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app: FastifyInstance, opts) => {
  const { prisma, jwtExpiresIn } = opts;

  // ─── POST /login ───────────────────────────────────────────────────

  app.post<{ Body: { email: string; password: string } }>(
    "/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Login",
        description: "Authenticate user with email/password and return JWT.",
        body: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        return sendError(reply, getAuthFailureStatus(), "INVALID_CREDENTIALS", "Invalid email or password");
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return sendError(reply, getAuthFailureStatus(), "INVALID_CREDENTIALS", "Invalid email or password");
      }

      const token = await reply.jwtSign(
        {
          userId: user.id,
          email: user.email,
          role: toRole(user.role),
        },
        { expiresIn: jwtExpiresIn },
      );

      return { token };
    },
  );

  // ─── POST /register ────────────────────────────────────────────────

  app.post<{ Body: { email: string; password: string; name?: string } }>(
    "/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Register new student account",
        description: "Create a new user with STUDENT role and return JWT.",
        body: {
          type: "object",
          required: ["email", "password"],
          additionalProperties: false,
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6, maxLength: 100 },
            name: { type: "string", minLength: 1, maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.toLowerCase().trim();

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return sendError(reply, 409, "EMAIL_TAKEN", "Email is already registered");
      }

      const passwordHash = await bcrypt.hash(request.body.password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.STUDENT,
          name: request.body.name?.trim() || null,
        },
      });

      const token = await reply.jwtSign(
        {
          userId: user.id,
          email: user.email,
          role: toRole(user.role),
        },
        { expiresIn: jwtExpiresIn },
      );

      return reply.code(201).send({ token });
    },
  );

  // ─── GET /me ───────────────────────────────────────────────────────

  app.get(
    "/me",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["auth"],
        summary: "Current user",
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          avatarUrl: true,
          bio: true,
        },
      });

      if (!user) {
        return sendError(reply, getAuthFailureStatus(), "UNAUTHORIZED", "Authentication required");
      }

      return {
        id: user.id,
        email: user.email,
        role: toRole(user.role),
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      };
    },
  );

  // ─── PATCH /me ─────────────────────────────────────────────────────

  app.patch<{ Body: { name?: string; bio?: string; avatarUrl?: string } }>(
    "/me",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["auth"],
        summary: "Update own profile",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: "string", maxLength: 100 },
            bio: { type: "string", maxLength: 1000 },
            avatarUrl: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (request) => {
      const data: Record<string, string | null> = {};
      if (request.body.name !== undefined) data.name = request.body.name.trim() || null;
      if (request.body.bio !== undefined) data.bio = request.body.bio.trim() || null;
      if (request.body.avatarUrl !== undefined) data.avatarUrl = request.body.avatarUrl.trim() || null;

      const user = await prisma.user.update({
        where: { id: request.user.userId },
        data,
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          avatarUrl: true,
          bio: true,
        },
      });

      return {
        id: user.id,
        email: user.email,
        role: toRole(user.role),
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      };
    },
  );
};

export default authRoutes;
