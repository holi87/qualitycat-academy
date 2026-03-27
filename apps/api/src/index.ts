import "dotenv/config";
import fastifyJwt from "@fastify/jwt";
import fastifyMultipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { createAuthenticateDecorator } from "./lib/auth.js";
import { SchedulerHandle, startResetScheduler } from "./lib/reset-scheduler.js";
import systemRoutes from "./routes/system.routes.js";
import authRoutes from "./routes/auth.routes.js";
import coursesRoutes from "./routes/courses.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import usersRoutes from "./routes/users.routes.js";
import uploadsRoutes from "./routes/uploads.routes.js";
import bugsRoutes from "./routes/bugs.routes.js";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "8081");
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "1h";
const dbResetScheduleEnabled = (process.env.DB_RESET_SCHEDULE_ENABLED ?? "off").trim().toLowerCase() === "on";
const dbResetScheduleCron = process.env.DB_RESET_SCHEDULE_CRON ?? "0 22 * * 0";
const dbResetScheduleTimezone = process.env.DB_RESET_SCHEDULE_TZ ?? "Europe/Warsaw";
let resetSchedulerHandle: SchedulerHandle | null = null;

if (!jwtSecret) {
  throw new Error("JWT_SECRET must be set");
}

void app.register(fastifyJwt, { secret: jwtSecret });
void app.register(fastifyMultipart, { limits: { fileSize: 2 * 1024 * 1024 } });
void app.register(fastifySwagger, {
  mode: "dynamic",
  openapi: {
    openapi: "3.0.3",
    info: {
      title: "QualityCat Academy API",
      description: "Backend API for training and mentoring workflows.",
      version: "0.1.0",
    },
    tags: [
      { name: "system", description: "Health and diagnostics" },
      { name: "auth", description: "Authentication and identity" },
      { name: "courses", description: "Courses management" },
      { name: "sessions", description: "Sessions management" },
      { name: "bookings", description: "Bookings management" },
      { name: "users", description: "User management" },
      { name: "admin", description: "Administrative operations" },
      { name: "uploads", description: "File uploads" },
      { name: "bugs", description: "Bug mode internal endpoints" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Use token from POST /auth/login",
        },
      },
    },
    servers: [
      { url: "/", description: "Direct API host (for localhost:8281)" },
      { url: "/api", description: "Traefik prefixed path (academy.qualitycat.com.pl)" },
    ],
  },
});
void app.register(fastifySwaggerUi, {
  routePrefix: "/api-docs",
  staticCSP: true,
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
    persistAuthorization: true,
  },
  transformSpecificationClone: true,
});

app.setNotFoundHandler(notFoundHandler);
app.setErrorHandler(errorHandler);
app.decorate("authenticate", createAuthenticateDecorator());

const routeOpts = { prisma, jwtExpiresIn };

void app.register(systemRoutes);
void app.register(authRoutes, { ...routeOpts, prefix: "/auth" });
void app.register(coursesRoutes, { ...routeOpts, prefix: "/courses" });
void app.register(sessionsRoutes, { ...routeOpts, prefix: "/sessions" });
void app.register(bookingsRoutes, { ...routeOpts, prefix: "/bookings" });
void app.register(usersRoutes, { ...routeOpts, prefix: "/users" });
void app.register(uploadsRoutes, { ...routeOpts, prefix: "/uploads" });
void app.register(adminRoutes, { ...routeOpts, prefix: "/admin" });
void app.register(bugsRoutes);

app.addHook("onClose", async (): Promise<void> => {
  if (resetSchedulerHandle) {
    resetSchedulerHandle.stop();
    resetSchedulerHandle = null;
  }

  await prisma.$disconnect();
});

const start = async (): Promise<void> => {
  try {
    resetSchedulerHandle = startResetScheduler({
      enabled: dbResetScheduleEnabled,
      cronExpression: dbResetScheduleCron,
      timezone: dbResetScheduleTimezone,
      prisma,
      logger: app.log,
    });

    await app.listen({ host, port });
  } catch (error) {
    if (resetSchedulerHandle) {
      resetSchedulerHandle.stop();
      resetSchedulerHandle = null;
    }

    app.log.error(error);
    process.exit(1);
  }
};

void start();
