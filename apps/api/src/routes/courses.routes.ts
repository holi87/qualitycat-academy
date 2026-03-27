import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { CourseLevel, Prisma, PrismaClient } from "@prisma/client";
import { sendError } from "../lib/errors.js";
import { isBugEnabled } from "../lib/bugs.js";
import { getPaginationSkip, buildPaginationMeta } from "../lib/pagination.js";
import { isAdminOrMentor, type CourseSortBy, type SortOrder } from "../types/shared.js";

type CoursesRoutesOptions = {
  prisma: PrismaClient;
};

const coursesRoutes: FastifyPluginAsync<CoursesRoutesOptions> = async (app: FastifyInstance, opts) => {
  const { prisma } = opts;

  // ─── GET / ── List courses ──────────────────────────────────────────

  app.get<{
    Querystring: {
      page: number;
      limit: number;
      sortBy: CourseSortBy;
      sortOrder: SortOrder;
      level?: CourseLevel;
      isPublished?: boolean;
      search?: string;
    };
  }>(
    "/",
    {
      schema: {
        tags: ["courses"],
        summary: "List courses",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            sortBy: { type: "string", enum: ["createdAt", "title"], default: "createdAt" },
            sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
            level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
            isPublished: { type: "boolean" },
            search: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request) => {
      const { page, limit, sortBy, sortOrder, level, isPublished, search } = request.query;
      const skip = getPaginationSkip(page, limit);

      const where: Prisma.CourseWhereInput = {};

      if (level) {
        where.level = level;
      }

      if (isPublished !== undefined) {
        where.isPublished = isPublished;
      }

      if (search) {
        where.title = { contains: search, mode: "insensitive" };
      }

      const orderBy: Prisma.CourseOrderByWithRelationInput =
        sortBy === "title" ? { title: sortOrder } : { createdAt: sortOrder };

      const omitDescription = isBugEnabled("BUG_COURSES_MISSING_FIELD");

      const [items, total] = await prisma.$transaction([
        prisma.course.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            title: true,
            description: !omitDescription,
            level: true,
            durationHours: true,
            imageUrl: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.course.count({ where }),
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
          ...buildPaginationMeta(page, limit, total),
          sortBy,
          sortOrder,
        },
      };
    },
  );

  // ─── GET /search ── Full-text search ────────────────────────────────

  app.get<{
    Querystring: {
      q: string;
      page: number;
      limit: number;
    };
  }>(
    "/search",
    {
      schema: {
        tags: ["courses"],
        summary: "Search courses by title and description",
        querystring: {
          type: "object",
          required: ["q"],
          additionalProperties: false,
          properties: {
            q: { type: "string", minLength: 1 },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
          },
        },
      },
    },
    async (request) => {
      const { q, page, limit } = request.query;
      const skip = getPaginationSkip(page, limit);

      const bugActive = isBugEnabled("BUG_SEARCH_WRONG_RESULTS");

      const containsFilter = bugActive
        ? { contains: q }
        : { contains: q, mode: "insensitive" as const };

      const where: Prisma.CourseWhereInput = {
        OR: [
          { title: containsFilter },
          { description: containsFilter },
        ],
      };

      const [items, total] = await prisma.$transaction([
        prisma.course.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            level: true,
            durationHours: true,
            imageUrl: true,
            isPublished: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.course.count({ where }),
      ]);

      return {
        data: items,
        meta: buildPaginationMeta(page, limit, total),
      };
    },
  );

  // ─── GET /:id ── Course details ─────────────────────────────────────

  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {
        tags: ["courses"],
        summary: "Get course details",
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
          reviews: {
            select: {
              id: true,
              rating: true,
            },
          },
        },
      });

      if (!course) {
        return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
      }

      const reviewCount = course.reviews.length;
      const averageRating =
        reviewCount > 0
          ? course.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
          : null;

      const { reviews: _reviews, ...courseData } = course;

      return {
        data: {
          ...courseData,
          _count: { reviews: reviewCount },
          _avg: { rating: averageRating },
        },
      };
    },
  );

  // ─── POST / ── Create course ────────────────────────────────────────

  app.post<{
    Body: {
      title: string;
      description?: string;
      level?: CourseLevel;
      durationHours?: number;
      imageUrl?: string;
    };
  }>(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["courses"],
        summary: "Create course",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["title"],
          additionalProperties: false,
          properties: {
            title: { type: "string", minLength: 3, maxLength: 120 },
            description: { type: "string", minLength: 3, maxLength: 5000 },
            level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
            durationHours: { type: "integer", minimum: 1 },
            imageUrl: { type: "string", format: "uri", maxLength: 2048 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isAdminOrMentor(request.user.role)) {
        return sendError(reply, 403, "FORBIDDEN", "Insufficient role");
      }

      const course = await prisma.course.create({
        data: {
          title: request.body.title.trim(),
          description: request.body.description?.trim() || null,
          level: request.body.level ?? "BEGINNER",
          durationHours: request.body.durationHours ?? null,
          imageUrl: request.body.imageUrl?.trim() || null,
        },
        select: {
          id: true,
          title: true,
          description: true,
          level: true,
          durationHours: true,
          imageUrl: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(201).send({ data: course });
    },
  );

  // ─── PUT /:id ── Full update ────────────────────────────────────────

  app.put<{
    Params: { id: string };
    Body: {
      title: string;
      description?: string;
      level?: CourseLevel;
      durationHours?: number;
      imageUrl?: string;
      isPublished?: boolean;
    };
  }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["courses"],
        summary: "Full update course",
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
          required: ["title"],
          additionalProperties: false,
          properties: {
            title: { type: "string", minLength: 3, maxLength: 120 },
            description: { type: "string", minLength: 3, maxLength: 5000 },
            level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
            durationHours: { type: "integer", minimum: 1 },
            imageUrl: { type: "string", format: "uri", maxLength: 2048 },
            isPublished: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isAdminOrMentor(request.user.role)) {
        return sendError(reply, 403, "FORBIDDEN", "Insufficient role");
      }

      const existing = await prisma.course.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!existing) {
        return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
      }

      const course = await prisma.course.update({
        where: { id: request.params.id },
        data: {
          title: request.body.title.trim(),
          description: request.body.description?.trim() || null,
          level: request.body.level ?? "BEGINNER",
          durationHours: request.body.durationHours ?? null,
          imageUrl: request.body.imageUrl?.trim() || null,
          isPublished: request.body.isPublished ?? true,
        },
        select: {
          id: true,
          title: true,
          description: true,
          level: true,
          durationHours: true,
          imageUrl: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(200).send({ data: course });
    },
  );

  // ─── PATCH /:id ── Partial update ───────────────────────────────────

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      level?: CourseLevel;
      durationHours?: number;
      imageUrl?: string;
      isPublished?: boolean;
    };
  }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["courses"],
        summary: "Partial update course",
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
          minProperties: 1,
          properties: {
            title: { type: "string", minLength: 3, maxLength: 120 },
            description: { type: "string", minLength: 3, maxLength: 5000 },
            level: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] },
            durationHours: { type: "integer", minimum: 1 },
            imageUrl: { type: "string", format: "uri", maxLength: 2048 },
            isPublished: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isAdminOrMentor(request.user.role)) {
        return sendError(reply, 403, "FORBIDDEN", "Insufficient role");
      }

      const existing = await prisma.course.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!existing) {
        return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
      }

      const data: Prisma.CourseUpdateInput = {};

      if (request.body.title !== undefined) {
        data.title = request.body.title.trim();
      }
      if (request.body.description !== undefined) {
        data.description = request.body.description.trim() || null;
      }
      if (request.body.level !== undefined) {
        data.level = request.body.level;
      }
      if (request.body.durationHours !== undefined) {
        data.durationHours = request.body.durationHours;
      }
      if (request.body.imageUrl !== undefined) {
        data.imageUrl = request.body.imageUrl.trim() || null;
      }
      if (request.body.isPublished !== undefined) {
        data.isPublished = request.body.isPublished;
      }

      const course = await prisma.course.update({
        where: { id: request.params.id },
        data,
        select: {
          id: true,
          title: true,
          description: true,
          level: true,
          durationHours: true,
          imageUrl: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(200).send({ data: course });
    },
  );

  // ─── DELETE /:id ── Cascade delete (admin only) ─────────────────────

  app.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["courses"],
        summary: "Delete course",
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
        return sendError(reply, 403, "FORBIDDEN", "Only admin can delete courses");
      }

      const existing = await prisma.course.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });

      if (!existing) {
        return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
      }

      await prisma.course.delete({
        where: { id: request.params.id },
      });

      return reply.code(204).send();
    },
  );

  // ─── GET /:id/reviews ── List reviews (public) ─────────────────────

  app.get<{
    Params: { id: string };
    Querystring: {
      page: number;
      limit: number;
    };
  }>(
    "/:id/reviews",
    {
      schema: {
        tags: ["courses", "reviews"],
        summary: "List course reviews",
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
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
      const { id } = request.params;
      const { page, limit } = request.query;
      const skip = getPaginationSkip(page, limit);

      const course = await prisma.course.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!course) {
        return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
      }

      const where: Prisma.ReviewWhereInput = { courseId: id };

      const [items, total] = await prisma.$transaction([
        prisma.review.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            courseId: true,
            userId: true,
            rating: true,
            comment: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        }),
        prisma.review.count({ where }),
      ]);

      return {
        data: items,
        meta: buildPaginationMeta(page, limit, total),
      };
    },
  );

  // ─── POST /:id/reviews ── Create review (student only) ─────────────

  app.post<{
    Params: { id: string };
    Body: {
      rating: number;
      comment?: string;
    };
  }>(
    "/:id/reviews",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["courses", "reviews"],
        summary: "Create course review",
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
          required: ["rating"],
          additionalProperties: false,
          properties: {
            rating: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string", maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.user.role !== "student") {
        return sendError(reply, 403, "FORBIDDEN", "Only students can create reviews");
      }

      const { id } = request.params;

      const course = await prisma.course.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!course) {
        return sendError(reply, 404, "COURSE_NOT_FOUND", "Course not found");
      }

      const existingReview = await prisma.review.findUnique({
        where: { courseId_userId: { courseId: id, userId: request.user.userId } },
        select: { id: true },
      });

      if (existingReview) {
        return sendError(reply, 409, "DUPLICATE_REVIEW", "You have already reviewed this course");
      }

      const review = await prisma.review.create({
        data: {
          courseId: id,
          userId: request.user.userId,
          rating: request.body.rating,
          comment: request.body.comment?.trim() || null,
        },
        select: {
          id: true,
          courseId: true,
          userId: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(201).send({ data: review });
    },
  );

  // ─── PATCH /:courseId/reviews/:reviewId ── Update review (owner) ────

  app.patch<{
    Params: { courseId: string; reviewId: string };
    Body: {
      rating?: number;
      comment?: string;
    };
  }>(
    "/:courseId/reviews/:reviewId",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["courses", "reviews"],
        summary: "Update course review",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["courseId", "reviewId"],
          properties: {
            courseId: { type: "string", minLength: 1 },
            reviewId: { type: "string", minLength: 1 },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            rating: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string", maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { courseId, reviewId } = request.params;

      const review = await prisma.review.findFirst({
        where: { id: reviewId, courseId },
        select: { id: true, userId: true },
      });

      if (!review) {
        return sendError(reply, 404, "REVIEW_NOT_FOUND", "Review not found");
      }

      if (review.userId !== request.user.userId) {
        return sendError(reply, 403, "FORBIDDEN", "You can only update your own reviews");
      }

      const data: Prisma.ReviewUpdateInput = {};

      if (request.body.rating !== undefined) {
        data.rating = request.body.rating;
      }
      if (request.body.comment !== undefined) {
        data.comment = request.body.comment.trim() || null;
      }

      const updated = await prisma.review.update({
        where: { id: reviewId },
        data,
        select: {
          id: true,
          courseId: true,
          userId: true,
          rating: true,
          comment: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.code(200).send({ data: updated });
    },
  );

  // ─── DELETE /:courseId/reviews/:reviewId ── Delete review (owner/admin) ──

  app.delete<{
    Params: { courseId: string; reviewId: string };
  }>(
    "/:courseId/reviews/:reviewId",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["courses", "reviews"],
        summary: "Delete course review",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          additionalProperties: false,
          required: ["courseId", "reviewId"],
          properties: {
            courseId: { type: "string", minLength: 1 },
            reviewId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { courseId, reviewId } = request.params;

      const review = await prisma.review.findFirst({
        where: { id: reviewId, courseId },
        select: { id: true, userId: true },
      });

      if (!review) {
        return sendError(reply, 404, "REVIEW_NOT_FOUND", "Review not found");
      }

      if (review.userId !== request.user.userId && request.user.role !== "admin") {
        return sendError(reply, 403, "FORBIDDEN", "You can only delete your own reviews");
      }

      await prisma.review.delete({
        where: { id: reviewId },
      });

      return reply.code(204).send();
    },
  );
};

export default coursesRoutes;
