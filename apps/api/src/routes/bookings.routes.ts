import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { BookingStatus, Prisma, PrismaClient } from "@prisma/client";
import { DomainError, sendError } from "../lib/errors.js";
import { isBugEnabled } from "../lib/bugs.js";
import { getPaginationSkip, buildPaginationMeta } from "../lib/pagination.js";
import { isStudent } from "../types/shared.js";

type BookingsRoutesOptions = {
  prisma: PrismaClient;
};

const bookingsRoutes: FastifyPluginAsync<BookingsRoutesOptions> = async (app: FastifyInstance, opts) => {
  const { prisma } = opts;

  // ─── POST / ── Create booking ────────────────────────────────────────

  app.post<{ Body: { sessionId: string } }>(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["bookings"],
        summary: "Create booking",
        security: [{ bearerAuth: [] }],
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

  // ─── GET /mine ── Current student bookings (paginated) ───────────────

  app.get<{
    Querystring: {
      page: number;
      limit: number;
    };
  }>(
    "/mine",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["bookings"],
        summary: "Current student bookings",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isStudent(request.user.role)) {
        return sendError(reply, 403, "FORBIDDEN", "Only student can access own bookings");
      }

      const { page, limit } = request.query;
      const skip = getPaginationSkip(page, limit);

      const where = isBugEnabled("BUG_BOOKINGS_LEAK")
        ? undefined
        : {
            userId: request.user.userId,
          };

      const [items, total] = await prisma.$transaction([
        prisma.booking.findMany({
          where,
          skip,
          take: limit,
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
        }),
        prisma.booking.count({ where }),
      ]);

      return {
        data: items,
        meta: buildPaginationMeta(page, limit, total),
      };
    },
  );

  // ─── GET / ── Admin: list all bookings (paginated + filters) ─────────

  app.get<{
    Querystring: {
      page: number;
      limit: number;
      userId?: string;
      sessionId?: string;
      status?: BookingStatus;
    };
  }>(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["bookings"],
        summary: "List all bookings (admin)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            userId: { type: "string", minLength: 1 },
            sessionId: { type: "string", minLength: 1 },
            status: { type: "string", enum: ["CONFIRMED", "CANCELLED"] },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.user.role !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "Admin access required");
      }

      const { page, limit, userId, sessionId, status } = request.query;
      const skip = getPaginationSkip(page, limit);

      const where: Prisma.BookingWhereInput = {};
      if (userId) {
        where.userId = userId;
      }
      if (sessionId) {
        where.sessionId = sessionId;
      }
      if (status) {
        where.status = status;
      }

      const [items, total] = await prisma.$transaction([
        prisma.booking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
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
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        }),
        prisma.booking.count({ where }),
      ]);

      return {
        data: items,
        meta: {
          ...buildPaginationMeta(page, limit, total),
          filters: {
            userId: userId ?? null,
            sessionId: sessionId ?? null,
            status: status ?? null,
          },
        },
      };
    },
  );

  // ─── GET /:id ── Booking details (owner or admin) ────────────────────

  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["bookings"],
        summary: "Get booking details",
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
      const booking = await prisma.booking.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          userId: true,
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
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!booking) {
        return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found");
      }

      if (request.user.role !== "admin" && booking.userId !== request.user.userId) {
        return sendError(reply, 403, "FORBIDDEN", "Not authorized to view this booking");
      }

      return { data: booking };
    },
  );

  // ─── PATCH /:id ── Cancel booking (owner or admin) ───────────────────

  app.patch<{
    Params: { id: string };
    Body: { status: "CANCELLED" };
  }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["bookings"],
        summary: "Cancel booking",
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
          required: ["status"],
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: ["CANCELLED"] },
          },
        },
      },
    },
    async (request, reply) => {
      const booking = await prisma.booking.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          userId: true,
          status: true,
        },
      });

      if (!booking) {
        return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found");
      }

      if (request.user.role !== "admin" && booking.userId !== request.user.userId) {
        return sendError(reply, 403, "FORBIDDEN", "Not authorized to cancel this booking");
      }

      if (booking.status === BookingStatus.CANCELLED) {
        return sendError(reply, 409, "ALREADY_CANCELLED", "Booking is already cancelled");
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
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

      return reply.code(200).send({ data: updated });
    },
  );

  // ─── DELETE /:id ── Hard delete booking (admin only) ─────────────────

  app.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["bookings"],
        summary: "Delete booking (admin)",
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

      const booking = await prisma.booking.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!booking) {
        return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found");
      }

      await prisma.booking.delete({
        where: { id: booking.id },
      });

      return reply.code(204).send();
    },
  );
};

export default bookingsRoutes;
