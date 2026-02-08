import "dotenv/config";
import fastifyJwt from "@fastify/jwt";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import Fastify, { FastifyReply, FastifyRequest } from "fastify";

type Role = "admin" | "mentor" | "student";

type JwtUser = {
  userId: string;
  email: string;
  role: Role;
};

const roleMap: Record<UserRole, Role> = {
  ADMIN: "admin",
  MENTOR: "mentor",
  STUDENT: "student",
};

const toRole = (role: UserRole): Role => roleMap[role];

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

app.decorate("authenticate", async (request, reply): Promise<void> => {
  try {
    await request.jwtVerify<JwtUser>();
  } catch {
    reply.code(401).send({ message: "Unauthorized" });
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
      return reply.code(401).send({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return reply.code(401).send({ message: "Invalid email or password" });
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
      return reply.code(401).send({ message: "Unauthorized" });
    }

    return {
      id: user.id,
      email: user.email,
      role: toRole(user.role),
    };
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
