import "dotenv/config";
import fastifyJwt from "@fastify/jwt";
import { PrismaClient, Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import Fastify, { FastifyError, FastifyReply, FastifyRequest } from "fastify";

type Role = "admin" | "mentor" | "student";
type CourseSortBy = "createdAt" | "title";
type SortOrder = "asc" | "desc";

type JwtUser = {
  userId: string;
  email: string;
  role: Role;
};

type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const roleMap: Record<UserRole, Role> = {
  ADMIN: "admin",
  MENTOR: "mentor",
  STUDENT: "student",
};

const toRole = (role: UserRole): Role => roleMap[role];

const sendError = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): FastifyReply => {
  const payload: ApiError = {
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  return reply.code(statusCode).send(payload);
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "8081");
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "1h";

if (!jwtSecret) {
  throw new Error("JWT_SECRET must be set");
}

void app.register(fastifyJwt, { secret: jwtSecret });

app.setNotFoundHandler((_, reply) => {
  return sendError(reply, 404, "NOT_FOUND", "Route not found");
});

app.setErrorHandler((error: FastifyError & { validation?: unknown }, request, reply) => {
  if (reply.sent) {
    return;
  }

  if (error.validation) {
    return sendError(reply, 400, "VALIDATION_ERROR", "Request validation failed", error.validation);
  }

  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return sendError(reply, error.statusCode, "REQUEST_ERROR", error.message);
  }

  request.log.error(error);
  return sendError(reply, 500, "INTERNAL_ERROR", "Internal server error");
});

app.decorate("authenticate", async (request, reply): Promise<void> => {
  try {
    await request.jwtVerify<JwtUser>();
  } catch {
    sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
  }
});

app.get("/health", async () => {
  return { status: "ok" };
});

app.post<{ Body: { email: string; password: string } }>(
  "/auth/login",
  {
    schema: {
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
      return sendError(reply, 401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return sendError(reply, 401, "INVALID_CREDENTIALS", "Invalid email or password");
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

app.get(
  "/me",
  {
    preHandler: [app.authenticate],
  },
  async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    return {
      id: user.id,
      email: user.email,
      role: toRole(user.role),
    };
  },
);

app.get<{ Querystring: { page: number; limit: number; sortBy: CourseSortBy; sortOrder: SortOrder } }>(
  "/courses",
  {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          page: { type: "integer", minimum: 1, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
          sortBy: { type: "string", enum: ["createdAt", "title"], default: "createdAt" },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
      },
    },
  },
  async (request) => {
    const { page, limit, sortBy, sortOrder } = request.query;
    const skip = (page - 1) * limit;

    const orderBy: Prisma.CourseOrderByWithRelationInput =
      sortBy === "title" ? { title: sortOrder } : { createdAt: sortOrder };

    const [items, total] = await prisma.$transaction([
      prisma.course.findMany({
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.course.count(),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        sortBy,
        sortOrder,
      },
    };
  },
);

app.get<{ Params: { id: string } }>(
  "/courses/:id",
  {
    schema: {
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
    const course = await prisma.course.findUnique({
      where: { id: request.params.id },
      include: {
        sessions: {
          orderBy: { startsAt: "asc" },
          select: {
            id: true,
            mentorId: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!course) {
      return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
    }

    return { data: course };
  },
);

app.post<{ Body: { title: string; description?: string } }>(
  "/courses",
  {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: "object",
        required: ["title"],
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 3, maxLength: 120 },
          description: { type: "string", minLength: 3, maxLength: 5000 },
        },
      },
    },
  },
  async (request, reply) => {
    if (request.user.role !== "admin" && request.user.role !== "mentor") {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient role");
    }

    const course = await prisma.course.create({
      data: {
        title: request.body.title.trim(),
        description: request.body.description?.trim() || null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.code(201).send({ data: course });
  },
);

app.addHook("onClose", async (): Promise<void> => {
  await prisma.$disconnect();
});

const start = async (): Promise<void> => {
  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
