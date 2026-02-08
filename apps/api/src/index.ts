import "dotenv/config";
import fastifyJwt from "@fastify/jwt";
import { BookingStatus, PrismaClient, Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import Fastify, { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { getBugFlagsSnapshot, isBugEnabled } from "./lib/bugs";

type Role = "admin" | "mentor" | "student";
type CourseSortBy = "createdAt" | "title";
type SessionSortBy = "createdAt" | "startsAt";
type SortOrder = "asc" | "desc";

type JwtUser = {
  userId: string;
  email: string;
  role: Role;
};

type ApiDocsEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: "public" | "bearer";
  roles?: Role[];
  description: string;
  query?: string[];
  body?: Record<string, unknown>;
  notes?: string[];
  curl: string;
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
const isAdminOrMentor = (role: Role): boolean => role === "admin" || role === "mentor";
const isStudent = (role: Role): boolean => role === "student";
const parseDateInput = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

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

const apiDocsEndpoints: ApiDocsEndpoint[] = [
  {
    method: "GET",
    path: "/health",
    auth: "public",
    description: "Service health check.",
    curl: 'curl -sSf "$BASE_URL/health"',
  },
  {
    method: "GET",
    path: "/api-docs",
    auth: "public",
    description: "Human-readable API docs page.",
    curl: 'curl -sS "$BASE_URL/api-docs"',
  },
  {
    method: "GET",
    path: "/api-docs.json",
    auth: "public",
    description: "Machine-readable API docs listing.",
    curl: 'curl -sS "$BASE_URL/api-docs.json"',
  },
  {
    method: "POST",
    path: "/auth/login",
    auth: "public",
    description: "Login and obtain JWT token.",
    body: {
      email: "student@qualitycat.academy",
      password: "student123",
    },
    curl:
      "curl -sS -H 'Content-Type: application/json' " +
      "-d '{\"email\":\"student@qualitycat.academy\",\"password\":\"student123\"}' " +
      '"$BASE_URL/auth/login"',
  },
  {
    method: "GET",
    path: "/me",
    auth: "bearer",
    roles: ["admin", "mentor", "student"],
    description: "Get current authenticated user profile.",
    curl: 'curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/me"',
  },
  {
    method: "GET",
    path: "/courses",
    auth: "public",
    description: "List courses with pagination and sorting.",
    query: ["page", "limit", "sortBy", "sortOrder"],
    curl: 'curl -sS "$BASE_URL/courses?page=1&limit=10&sortBy=title&sortOrder=asc"',
  },
  {
    method: "GET",
    path: "/courses/:id",
    auth: "public",
    description: "Get single course with sessions.",
    curl: 'curl -sS "$BASE_URL/courses/<COURSE_ID>"',
  },
  {
    method: "POST",
    path: "/courses",
    auth: "bearer",
    roles: ["admin", "mentor"],
    description: "Create a new course.",
    body: {
      title: "New Course",
      description: "Optional description",
    },
    curl:
      "curl -sS -X POST -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' " +
      "-d '{\"title\":\"New Course\",\"description\":\"Optional description\"}' " +
      '"$BASE_URL/courses"',
  },
  {
    method: "GET",
    path: "/sessions",
    auth: "public",
    description: "List sessions with filters and pagination.",
    query: ["page", "limit", "sortBy", "sortOrder", "courseId", "from", "to"],
    curl: 'curl -sS "$BASE_URL/sessions?page=1&limit=10&sortBy=startsAt&sortOrder=asc"',
  },
  {
    method: "POST",
    path: "/sessions",
    auth: "bearer",
    roles: ["admin", "mentor"],
    description: "Create a new session.",
    body: {
      courseId: "<COURSE_ID>",
      mentorId: "<MENTOR_ID>",
      startsAt: "2026-12-01T10:00:00.000Z",
      endsAt: "2026-12-01T12:00:00.000Z",
      capacity: 20,
    },
    notes: ["mentorId is required for admin and forced to current user for mentor role."],
    curl:
      "curl -sS -X POST -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' " +
      "-d '{\"courseId\":\"<COURSE_ID>\",\"mentorId\":\"<MENTOR_ID>\",\"startsAt\":\"2026-12-01T10:00:00.000Z\",\"endsAt\":\"2026-12-01T12:00:00.000Z\",\"capacity\":20}' " +
      '"$BASE_URL/sessions"',
  },
  {
    method: "POST",
    path: "/bookings",
    auth: "bearer",
    roles: ["student"],
    description: "Create (or reactivate) booking for a session.",
    body: {
      sessionId: "<SESSION_ID>",
    },
    curl:
      "curl -sS -X POST -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' " +
      "-d '{\"sessionId\":\"<SESSION_ID>\"}' " +
      '"$BASE_URL/bookings"',
  },
  {
    method: "GET",
    path: "/bookings/mine",
    auth: "bearer",
    roles: ["student"],
    description: "List current student bookings.",
    curl: 'curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/bookings/mine"',
  },
  {
    method: "GET",
    path: "/internal/bugs",
    auth: "bearer",
    roles: ["admin", "mentor"],
    description: "Read backend bug flags and mode.",
    curl: 'curl -sS -H "Authorization: Bearer $TOKEN" "$BASE_URL/internal/bugs"',
  },
  {
    method: "GET",
    path: "/__debug/flags",
    auth: "public",
    description: "Read backend debug flags when BUGS=on.",
    notes: ["Route exists only when BUGS=on."],
    curl: 'curl -sS "$BASE_URL/__debug/flags"',
  },
];

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const renderApiDocsHtml = (): string => {
  const rows = apiDocsEndpoints
    .map((endpoint) => {
      const roles = endpoint.roles ? endpoint.roles.join(", ") : "-";
      const query = endpoint.query ? endpoint.query.join(", ") : "-";
      const body = endpoint.body ? escapeHtml(JSON.stringify(endpoint.body, null, 2)) : "-";
      const notes =
        endpoint.notes && endpoint.notes.length > 0
          ? endpoint.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")
          : "<li>-</li>";

      return `
        <article class="endpoint-card">
          <h2><span class="method">${escapeHtml(endpoint.method)}</span> <span class="path">${escapeHtml(endpoint.path)}</span></h2>
          <p>${escapeHtml(endpoint.description)}</p>
          <p><strong>Auth:</strong> ${escapeHtml(endpoint.auth)}</p>
          <p><strong>Roles:</strong> ${escapeHtml(roles)}</p>
          <p><strong>Query params:</strong> ${escapeHtml(query)}</p>
          <p><strong>Body example:</strong></p>
          <pre>${body}</pre>
          <p><strong>Notes:</strong></p>
          <ul>${notes}</ul>
          <p><strong>Curl:</strong></p>
          <pre>${escapeHtml(endpoint.curl)}</pre>
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QualityCat Academy API Docs</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f5f7fb; color: #172136; }
    main { width: min(1040px, 94vw); margin: 0 auto; padding: 24px 0 36px; }
    .hero { background: #fff; border: 1px solid #d7dfec; border-radius: 12px; padding: 18px; margin-bottom: 14px; }
    .hero h1 { margin: 0 0 10px; font-size: 24px; }
    .hero p { margin: 6px 0; color: #445777; }
    .endpoint-grid { display: grid; gap: 12px; }
    .endpoint-card { background: #fff; border: 1px solid #d7dfec; border-radius: 12px; padding: 14px; }
    .endpoint-card h2 { margin: 0 0 8px; font-size: 17px; }
    .method { display: inline-block; background: #0a66ff; color: #fff; border-radius: 999px; padding: 2px 9px; font-size: 12px; }
    .path { font-family: "Courier New", monospace; margin-left: 6px; }
    .endpoint-card p { margin: 7px 0; }
    pre { background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 10px; overflow: auto; white-space: pre-wrap; }
    ul { margin: 6px 0 0 18px; padding: 0; }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>QualityCat Academy API Docs</h1>
      <p><strong>Base URL (dev direct):</strong> <code>http://localhost:8281</code></p>
      <p><strong>Base URL (prod via Traefik):</strong> <code>http://academy.qualitycat.com.pl/api</code></p>
      <p><strong>JWT:</strong> send <code>Authorization: Bearer &lt;TOKEN&gt;</code></p>
      <p><strong>Error format:</strong> <code>{ "error": { "code": "...", "message": "...", "details": ... } }</code></p>
      <p>Set shell helper before testing: <code>export BASE_URL=http://localhost:8281</code></p>
    </section>
    <section class="endpoint-grid">
      ${rows}
    </section>
  </main>
</body>
</html>`;
};

const getAuthFailureStatus = (): number => (isBugEnabled("BUG_AUTH_WRONG_STATUS") ? 403 : 401);
const getPaginationSkip = (page: number, limit: number): number => {
  if (isBugEnabled("BUG_PAGINATION_MIXED_BASE")) {
    return page * limit;
  }

  return (page - 1) * limit;
};

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
    return sendError(reply, getAuthFailureStatus(), "UNAUTHORIZED", "Authentication required");
  }
});

app.get("/health", async () => {
  return { status: "ok" };
});

app.get("/api-docs.json", async () => {
  return {
    service: "qualitycat-academy-api",
    generatedAt: new Date().toISOString(),
    baseUrls: {
      devDirect: "http://localhost:8281",
      prodViaTraefik: "http://academy.qualitycat.com.pl/api",
    },
    auth: {
      type: "Bearer JWT",
      header: "Authorization: Bearer <TOKEN>",
    },
    errorFormat: {
      error: {
        code: "string",
        message: "string",
        details: "optional",
      },
    },
    endpoints: apiDocsEndpoints,
  };
});

app.get("/api-docs", async (_, reply) => {
  return reply.type("text/html; charset=utf-8").send(renderApiDocsHtml());
});

if (isBugEnabled()) {
  app.get("/__debug/flags", async () => {
    return getBugFlagsSnapshot();
  });
}

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
      return sendError(reply, getAuthFailureStatus(), "UNAUTHORIZED", "Authentication required");
    }

    return {
      id: user.id,
      email: user.email,
      role: toRole(user.role),
    };
  },
);

app.get(
  "/internal/bugs",
  {
    preHandler: [app.authenticate],
  },
  async (request, reply) => {
    if (!isAdminOrMentor(request.user.role)) {
      return sendError(reply, 403, "FORBIDDEN", "Mentor or admin role required");
    }

    return {
      data: getBugFlagsSnapshot(),
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
    const skip = getPaginationSkip(page, limit);

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

    if (isBugEnabled("BUG_NPLUS1_COURSES")) {
      await Promise.all(
        items.map(async (course) => {
          await prisma.session.count({
            where: { courseId: course.id },
          });
        }),
      );
    }

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

app.get<{
  Querystring: {
    page: number;
    limit: number;
    sortBy: SessionSortBy;
    sortOrder: SortOrder;
    courseId?: string;
    from?: string;
    to?: string;
  };
}>(
  "/sessions",
  {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          page: { type: "integer", minimum: 1, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
          sortBy: { type: "string", enum: ["createdAt", "startsAt"], default: "startsAt" },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
          courseId: { type: "string", minLength: 1 },
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
        },
      },
    },
  },
  async (request, reply) => {
    const { page, limit, sortBy, sortOrder, courseId, from, to } = request.query;
    const fromDate = from ? parseDateInput(from) : null;
    const toDate = to ? parseDateInput(to) : null;

    if (from && !fromDate) {
      return sendError(reply, 400, "INVALID_DATE", "Invalid 'from' date");
    }

    if (to && !toDate) {
      return sendError(reply, 400, "INVALID_DATE", "Invalid 'to' date");
    }

    if (fromDate && toDate && fromDate > toDate) {
      return sendError(reply, 400, "INVALID_DATE_RANGE", "'from' must be before or equal to 'to'");
    }

    const where: Prisma.SessionWhereInput = {};
    if (courseId) {
      where.courseId = courseId;
    }

    if (fromDate || toDate) {
      where.startsAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const skip = getPaginationSkip(page, limit);
    const orderBy: Prisma.SessionOrderByWithRelationInput =
      sortBy === "createdAt" ? { createdAt: sortOrder } : { startsAt: sortOrder };

    const [items, total] = await prisma.$transaction([
      prisma.session.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          courseId: true,
          mentorId: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          createdAt: true,
          updatedAt: true,
          course: {
            select: {
              id: true,
              title: true,
            },
          },
          mentor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      prisma.session.count({ where }),
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
        filters: {
          courseId: courseId ?? null,
          from: from ?? null,
          to: to ?? null,
        },
      },
    };
  },
);

app.post<{
  Body: {
    courseId: string;
    mentorId?: string;
    startsAt: string;
    endsAt: string;
    capacity: number;
  };
}>(
  "/sessions",
  {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: "object",
        required: ["courseId", "startsAt", "endsAt", "capacity"],
        additionalProperties: false,
        properties: {
          courseId: { type: "string", minLength: 1 },
          mentorId: { type: "string", minLength: 1 },
          startsAt: { type: "string", format: "date-time" },
          endsAt: { type: "string", format: "date-time" },
          capacity: { type: "integer", minimum: 1, maximum: 500 },
        },
      },
    },
  },
  async (request, reply) => {
    if (!isAdminOrMentor(request.user.role)) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient role");
    }

    const startsAt = parseDateInput(request.body.startsAt);
    const endsAt = parseDateInput(request.body.endsAt);
    if (!startsAt || !endsAt) {
      return sendError(reply, 400, "INVALID_DATE", "Invalid session dates");
    }

    if (startsAt >= endsAt) {
      return sendError(reply, 400, "INVALID_DATE_RANGE", "'startsAt' must be before 'endsAt'");
    }

    let mentorId = request.body.mentorId;
    if (request.user.role === "mentor") {
      if (mentorId && mentorId !== request.user.userId) {
        return sendError(reply, 403, "FORBIDDEN", "Mentor can create only own sessions");
      }
      mentorId = request.user.userId;
    } else if (!mentorId) {
      return sendError(reply, 400, "VALIDATION_ERROR", "mentorId is required for admin");
    }

    const [course, mentor] = await prisma.$transaction([
      prisma.course.findUnique({
        where: { id: request.body.courseId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: mentorId },
        select: { id: true, role: true },
      }),
    ]);

    if (!course) {
      return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
    }

    if (!mentor || mentor.role !== UserRole.MENTOR) {
      return sendError(reply, 400, "INVALID_MENTOR", "mentorId must reference a mentor user");
    }

    const session = await prisma.session.create({
      data: {
        courseId: request.body.courseId,
        mentorId: mentor.id,
        startsAt,
        endsAt,
        capacity: request.body.capacity,
      },
      select: {
        id: true,
        courseId: true,
        mentorId: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.code(201).send({ data: session });
  },
);

app.post<{ Body: { sessionId: string } }>(
  "/bookings",
  {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: "object",
        required: ["sessionId"],
        additionalProperties: false,
        properties: {
          sessionId: { type: "string", minLength: 1 },
        },
      },
    },
  },
  async (request, reply) => {
    if (!isStudent(request.user.role)) {
      return sendError(reply, 403, "FORBIDDEN", "Only student can create bookings");
    }

    try {
      const selectShape = {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        session: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      } as const;

      const runBookingFlow = async (
        db: Prisma.TransactionClient | PrismaClient,
        withArtificialDelay: boolean,
      ): Promise<{
        booking: {
          id: string;
          status: BookingStatus;
          createdAt: Date;
          updatedAt: Date;
          session: {
            id: string;
            startsAt: Date;
            endsAt: Date;
            capacity: number;
            course: {
              id: string;
              title: string;
            };
          };
        };
        wasReactivated: boolean;
      }> => {
        const session = await db.session.findUnique({
          where: { id: request.body.sessionId },
          select: {
            id: true,
            capacity: true,
          },
        });

        if (!session) {
          throw new DomainError(404, "SESSION_NOT_FOUND", "Session not found");
        }

        const existing = await db.booking.findUnique({
          where: {
            sessionId_userId: {
              sessionId: session.id,
              userId: request.user.userId,
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

        if (existing?.status === BookingStatus.CONFIRMED) {
          throw new DomainError(409, "ALREADY_BOOKED", "Session already booked");
        }

        const confirmedCount = await db.booking.count({
          where: {
            sessionId: session.id,
            status: BookingStatus.CONFIRMED,
          },
        });

        if (confirmedCount >= session.capacity) {
          throw new DomainError(409, "SESSION_FULL", "Session has reached capacity");
        }

        if (withArtificialDelay) {
          await new Promise((resolve) => {
            setTimeout(resolve, 120);
          });
        }

        const booking =
          existing?.status === BookingStatus.CANCELLED
            ? await db.booking.update({
                where: { id: existing.id },
                data: { status: BookingStatus.CONFIRMED },
                select: selectShape,
              })
            : await db.booking.create({
                data: {
                  sessionId: session.id,
                  userId: request.user.userId,
                  status: BookingStatus.CONFIRMED,
                },
                select: selectShape,
              });

        return {
          booking,
          wasReactivated: existing?.status === BookingStatus.CANCELLED,
        };
      };

      const result = isBugEnabled("BUG_BOOKINGS_RACE")
        ? await runBookingFlow(prisma, true)
        : await prisma.$transaction(
            async (tx) => runBookingFlow(tx, false),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );

      return reply.code(result.wasReactivated ? 200 : 201).send({ data: result.booking });
    } catch (error) {
      if (error instanceof DomainError) {
        return sendError(reply, error.statusCode, error.code, error.message, error.details);
      }

      throw error;
    }
  },
);

app.get(
  "/bookings/mine",
  {
    preHandler: [app.authenticate],
  },
  async (request, reply) => {
    if (!isStudent(request.user.role)) {
      return sendError(reply, 403, "FORBIDDEN", "Only student can access own bookings");
    }

    const where = isBugEnabled("BUG_BOOKINGS_LEAK")
      ? undefined
      : {
          userId: request.user.userId,
        };

    const items = await prisma.booking.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        session: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return { data: items };
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
