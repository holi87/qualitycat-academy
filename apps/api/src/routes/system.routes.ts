import { FastifyInstance, FastifyPluginAsync } from "fastify";

const isAcademyDomainHost = (hostHeader: string | undefined): boolean => {
  return (hostHeader ?? "").includes("academy.qualitycat.com.pl");
};

const resolveOpenApiServers = (hostHeader: string | undefined): Array<{ url: string; description: string }> => {
  if (isAcademyDomainHost(hostHeader)) {
    return [{ url: "/api", description: "Via Traefik path prefix (/api)" }];
  }

  return [{ url: "/", description: "Direct API host" }];
};

const systemRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Health check",
        description: "Simple liveness probe endpoint.",
      },
    },
    async () => {
      return { status: "ok" };
    },
  );

  app.get("/api-docs.json", { schema: { hide: true } }, async (request) => {
    return {
      ...app.swagger(),
      servers: resolveOpenApiServers(request.headers.host),
    };
  });

  app.get("/api-docs/openapi.json", { schema: { hide: true } }, async (request) => {
    return {
      ...app.swagger(),
      servers: resolveOpenApiServers(request.headers.host),
    };
  });
};

export default systemRoutes;
