import "dotenv/config";
import Fastify from "fastify";

const app = Fastify({ logger: true });
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? "8081");

app.get("/health", async () => {
  return { status: "ok" };
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
