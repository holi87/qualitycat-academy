"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const jwt_1 = __importDefault(require("@fastify/jwt"));
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const fastify_1 = __importDefault(require("fastify"));
const roleMap = {
    ADMIN: "admin",
    MENTOR: "mentor",
    STUDENT: "student",
};
const toRole = (role) => roleMap[role];
const app = (0, fastify_1.default)({ logger: true });
const prisma = new client_1.PrismaClient();
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "8081");
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "1h";
if (!jwtSecret) {
    throw new Error("JWT_SECRET must be set");
}
void app.register(jwt_1.default, { secret: jwtSecret });
app.decorate("authenticate", async (request, reply) => {
    try {
        await request.jwtVerify();
    }
    catch {
        reply.code(401).send({ message: "Unauthorized" });
    }
});
app.get("/health", async () => {
    return { status: "ok" };
});
app.post("/auth/login", {
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
}, async (request, reply) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (!user) {
        return reply.code(401).send({ message: "Invalid email or password" });
    }
    const isPasswordValid = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isPasswordValid) {
        return reply.code(401).send({ message: "Invalid email or password" });
    }
    const token = await reply.jwtSign({
        userId: user.id,
        email: user.email,
        role: toRole(user.role),
    }, { expiresIn: jwtExpiresIn });
    return { token };
});
app.get("/me", {
    preHandler: [app.authenticate],
}, async (request, reply) => {
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
});
app.addHook("onClose", async () => {
    await prisma.$disconnect();
});
const start = async () => {
    try {
        await app.listen({ host, port });
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};
void start();
