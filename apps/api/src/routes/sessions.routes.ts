import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { BookingStatus, Prisma, PrismaClient, UserRole } from "@prisma/client";
import { sendError } from "../lib/errors.js";
import { isBugEnabled } from "../lib/bugs.js";
import { getPaginationSkip, buildPaginationMeta } from "../lib/pagination.js";
import { isAdminOrMentor, parseDateInput } from "../types/shared.js";
import type { SessionSortBy, SortOrder } from "../types/shared.js";

type SessionsRoutesOptions = {
  prisma: PrismaClient;
};

const sessionsRoutes: FastifyPluginAsync<SessionsRoutesOptions> = async (app: FastifyInstance, opts) => {
  const { prisma } = opts;

  // ---------------------------------------------------------------------------
  // GET / - List sessions
  // ---------------------------------------------------------------------------
  app.get<{
    Querystring: {
      page: number;
      limit: number;
      sortBy: SessionSortBy;
      sortOrder: SortOrder;
      courseId?: string;
      mentorId?: string;
      location?: string;
      from?: string;
      to?: string;
    };
  }>(
    "/",
    {
      schema: {
        tags: ["sessions"],
        summary: "List sessions",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            sortBy: { type: "string", enum: ["createdAt", "startsAt"], default: "startsAt" },
            sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
            courseId: { type: "string", minLength: 1 },
            mentorId: { type: "string", minLength: 1 },
            location: { type: "string", minLength: 1 },
            from: { type: "string", format: "date-time" },
            to: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (request, reply) => {
      const { page, limit, sortBy, sortOrder, courseId, mentorId, location, from, to } = request.query;
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

      if (mentorId) {
        where.mentorId = mentorId;
      }

      if (location) {
        where.location = { contains: location, mode: "insensitive" };
      }

      if (fromDate || toDate) {
        where.startsAt = {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        };
      }

      const skip = getPaginationSkip(page, limit);

      // BUG_SESSIONS_WRONG_SORT: flip the sort order when enabled
      let effectiveSortOrder = sortOrder;
      if (isBugEnabled("BUG_SESSIONS_WRONG_SORT")) {
        effectiveSortOrder = sortOrder === "asc" ? "desc" : "asc";
      }

      const orderBy: Prisma.SessionOrderByWithRelationInput =
        sortBy === "createdAt" ? { createdAt: effectiveSortOrder } : { startsAt: effectiveSortOrder };

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
            location: true,
            description: true,
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
          ...buildPaginationMeta(page, limit, total),
          sortBy,
          sortOrder,
          filters: {
            courseId: courseId ?? null,
            mentorId: mentorId ?? null,
            location: location ?? null,
            from: from ?? null,
            to: to ?? null,
          },
        },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // GET /:id - Session details
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {
        tags: ["sessions"],
        summary: "Get session details",
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
      const session = await prisma.session.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          courseId: true,
          mentorId: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          location: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              level: true,
              durationHours: true,
            },
          },
          mentor: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          _count: {
            select: {
              bookings: { where: { status: BookingStatus.CONFIRMED } },
            },
          },
        },
      });

      if (!session) {
        return sendError(reply, 404, "SESSION_NOT_FOUND", "Session not found");
      }

      const bookingCount = session._count.bookings;
      const availableSpots = session.capacity - bookingCount;

      const { _count, ...rest } = session;
      return {
        data: {
          ...rest,
          bookingCount,
          availableSpots,
        },
      };
    },
  );

  // ---------------------------------------------------------------------------
  // POST / - Create session
  // ---------------------------------------------------------------------------
  app.post<{
    Body: {
      courseId: string;
      mentorId?: string;
      startsAt: string;
      endsAt: string;
      capacity: number;
      location?: string;
      description?: string;
    };
  }>(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["sessions"],
        summary: "Create session",
        security: [{ bearerAuth: [] }],
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
            location: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", minLength: 1, maxLength: 2000 },
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
          location: request.body.location?.trim() || null,
          description: request.body.description?.trim() || null,
        },
        select: {
          id: true,
          courseId: true,
          mentorId: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          location: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(201).send({ data: session });
    },
  );

  // ---------------------------------------------------------------------------
  // PUT /:id - Full update session (admin or owning mentor)
  // ---------------------------------------------------------------------------
  app.put<{
    Params: { id: string };
    Body: {
      courseId: string;
      mentorId: string;
      startsAt: string;
      endsAt: string;
      capacity: number;
      location?: string | null;
      description?: string | null;
    };
  }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["sessions"],
        summary: "Full update session",
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
          required: ["courseId", "mentorId", "startsAt", "endsAt", "capacity"],
          additionalProperties: false,
          properties: {
            courseId: { type: "string", minLength: 1 },
            mentorId: { type: "string", minLength: 1 },
            startsAt: { type: "string", format: "date-time" },
            endsAt: { type: "string", format: "date-time" },
            capacity: { type: "integer", minimum: 1, maximum: 500 },
            location: { type: ["string", "null"], minLength: 1, maxLength: 200 },
            description: { type: ["string", "null"], minLength: 1, maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isAdminOrMentor(request.user.role)) {
        return sendError(reply, 403, "FORBIDDEN", "Insufficient role");
      }

      const existing = await prisma.session.findUnique({
        where: { id: request.params.id },
        select: { id: true, mentorId: true },
      });

      if (!existing) {
        return sendError(reply, 404, "SESSION_NOT_FOUND", "Session not found");
      }

      if (request.user.role === "mentor" && existing.mentorId !== request.user.userId) {
        return sendError(reply, 403, "FORBIDDEN", "Mentor can update only own sessions");
      }

      const startsAt = parseDateInput(request.body.startsAt);
      const endsAt = parseDateInput(request.body.endsAt);
      if (!startsAt || !endsAt) {
        return sendError(reply, 400, "INVALID_DATE", "Invalid session dates");
      }

      if (startsAt >= endsAt) {
        return sendError(reply, 400, "INVALID_DATE_RANGE", "'startsAt' must be before 'endsAt'");
      }

      // Validate course exists
      const course = await prisma.course.findUnique({
        where: { id: request.body.courseId },
        select: { id: true },
      });

      if (!course) {
        return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
      }

      // Validate mentor exists and has mentor role
      const mentor = await prisma.user.findUnique({
        where: { id: request.body.mentorId },
        select: { id: true, role: true },
      });

      if (!mentor || mentor.role !== UserRole.MENTOR) {
        return sendError(reply, 400, "INVALID_MENTOR", "mentorId must reference a mentor user");
      }

      // Cannot reduce capacity below confirmed bookings count
      const confirmedCount = await prisma.booking.count({
        where: { sessionId: existing.id, status: BookingStatus.CONFIRMED },
      });

      if (request.body.capacity < confirmedCount) {
        return sendError(
          reply,
          400,
          "CAPACITY_TOO_LOW",
          `Cannot reduce capacity below confirmed bookings count (${confirmedCount})`,
        );
      }

      const session = await prisma.session.update({
        where: { id: existing.id },
        data: {
          courseId: request.body.courseId,
          mentorId: request.body.mentorId,
          startsAt,
          endsAt,
          capacity: request.body.capacity,
          location: request.body.location?.trim() || null,
          description: request.body.description?.trim() || null,
        },
        select: {
          id: true,
          courseId: true,
          mentorId: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          location: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(200).send({ data: session });
    },
  );

  // ---------------------------------------------------------------------------
  // PATCH /:id - Partial update session (admin or owning mentor)
  // ---------------------------------------------------------------------------
  app.patch<{
    Params: { id: string };
    Body: {
      courseId?: string;
      mentorId?: string;
      startsAt?: string;
      endsAt?: string;
      capacity?: number;
      location?: string | null;
      description?: string | null;
    };
  }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["sessions"],
        summary: "Partial update session",
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
            courseId: { type: "string", minLength: 1 },
            mentorId: { type: "string", minLength: 1 },
            startsAt: { type: "string", format: "date-time" },
            endsAt: { type: "string", format: "date-time" },
            capacity: { type: "integer", minimum: 1, maximum: 500 },
            location: { type: ["string", "null"], minLength: 1, maxLength: 200 },
            description: { type: ["string", "null"], minLength: 1, maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isAdminOrMentor(request.user.role)) {
        return sendError(reply, 403, "FORBIDDEN", "Insufficient role");
      }

      const existing = await prisma.session.findUnique({
        where: { id: request.params.id },
        select: { id: true, mentorId: true, startsAt: true, endsAt: true },
      });

      if (!existing) {
        return sendError(reply, 404, "SESSION_NOT_FOUND", "Session not found");
      }

      if (request.user.role === "mentor" && existing.mentorId !== request.user.userId) {
        return sendError(reply, 403, "FORBIDDEN", "Mentor can update only own sessions");
      }

      const data: Prisma.SessionUpdateInput = {};

      if (request.body.courseId !== undefined) {
        const course = await prisma.course.findUnique({
          where: { id: request.body.courseId },
          select: { id: true },
        });
        if (!course) {
          return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
        }
        data.course = { connect: { id: request.body.courseId } };
      }

      if (request.body.mentorId !== undefined) {
        const mentor = await prisma.user.findUnique({
          where: { id: request.body.mentorId },
          select: { id: true, role: true },
        });
        if (!mentor || mentor.role !== UserRole.MENTOR) {
          return sendError(reply, 400, "INVALID_MENTOR", "mentorId must reference a mentor user");
        }
        data.mentor = { connect: { id: request.body.mentorId } };
      }

      // Parse and validate dates
      let resolvedStartsAt: Date | undefined;
      let resolvedEndsAt: Date | undefined;

      if (request.body.startsAt !== undefined) {
        const parsed = parseDateInput(request.body.startsAt);
        if (!parsed) {
          return sendError(reply, 400, "INVALID_DATE", "Invalid 'startsAt' date");
        }
        resolvedStartsAt = parsed;
        data.startsAt = parsed;
      }

      if (request.body.endsAt !== undefined) {
        const parsed = parseDateInput(request.body.endsAt);
        if (!parsed) {
          return sendError(reply, 400, "INVALID_DATE", "Invalid 'endsAt' date");
        }
        resolvedEndsAt = parsed;
        data.endsAt = parsed;
      }

      // Validate date order using resolved or existing dates
      const effectiveStartsAt = resolvedStartsAt ?? existing.startsAt;
      const effectiveEndsAt = resolvedEndsAt ?? existing.endsAt;
      if (effectiveStartsAt >= effectiveEndsAt) {
        return sendError(reply, 400, "INVALID_DATE_RANGE", "'startsAt' must be before 'endsAt'");
      }

      // Capacity validation
      if (request.body.capacity !== undefined) {
        const confirmedCount = await prisma.booking.count({
          where: { sessionId: existing.id, status: BookingStatus.CONFIRMED },
        });

        if (request.body.capacity < confirmedCount) {
          return sendError(
            reply,
            400,
            "CAPACITY_TOO_LOW",
            `Cannot reduce capacity below confirmed bookings count (${confirmedCount})`,
          );
        }
        data.capacity = request.body.capacity;
      }

      if (request.body.location !== undefined) {
        data.location = request.body.location?.trim() || null;
      }

      if (request.body.description !== undefined) {
        data.description = request.body.description?.trim() || null;
      }

      const session = await prisma.session.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          courseId: true,
          mentorId: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          location: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(200).send({ data: session });
    },
  );

  // ---------------------------------------------------------------------------
  // DELETE /:id - Delete session (admin only, cascades bookings)
  // ---------------------------------------------------------------------------
  app.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["sessions"],
        summary: "Delete session",
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

      const existing = await prisma.session.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!existing) {
        return sendError(reply, 404, "SESSION_NOT_FOUND", "Session not found");
      }

      // Cascade: delete bookings first, then the session
      await prisma.$transaction([
        prisma.booking.deleteMany({ where: { sessionId: existing.id } }),
        prisma.session.delete({ where: { id: existing.id } }),
      ]);

      return reply.code(204).send();
    },
  );
};

export default sessionsRoutes;
