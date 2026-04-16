import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../lib/errors.js";
import { isBugEnabled } from "../lib/bugs.js";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import crypto from "node:crypto";

type UploadsRoutesOptions = {
  prisma: PrismaClient;
};

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/tmp/academy-uploads";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const uploadsRoutes: FastifyPluginAsync<UploadsRoutesOptions> = async (app: FastifyInstance, opts) => {
  const { prisma } = opts;

  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // ─── POST / ── Upload image ────────────────────────────────────────

  app.post(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["uploads"],
        summary: "Upload an image",
        description: "Upload an image file (JPEG, PNG, WebP). Max 2MB.",
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const data = await request.file();

      if (!data) {
        return sendError(reply, 400, "NO_FILE", "No file uploaded");
      }

      // BUG: skip MIME type validation
      if (!isBugEnabled("BUG_FILE_UPLOAD_NO_MIME_CHECK")) {
        if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
          // Consume the stream to prevent hanging
          data.file.resume();
          return sendError(reply, 400, "INVALID_FILE_TYPE", `Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`);
        }
      }

      const fileId = crypto.randomUUID();
      const ext = path.extname(data.filename) || ".bin";
      const storedName = `${fileId}${ext}`;
      const storagePath = path.join(UPLOAD_DIR, storedName);

      let sizeBytes = 0;
      let tooLarge = false;
      const sizeLimiter = new Transform({
        transform(chunk, _encoding, callback) {
          sizeBytes += chunk.length;
          if (sizeBytes > MAX_FILE_SIZE) {
            tooLarge = true;
            callback(new Error("FILE_TOO_LARGE"));
            return;
          }
          callback(null, chunk);
        },
      });

      try {
        await pipeline(data.file, sizeLimiter, fs.createWriteStream(storagePath));
      } catch (error) {
        await fs.promises.unlink(storagePath).catch(() => undefined);
        if (tooLarge) {
          return sendError(
            reply,
            400,
            "FILE_TOO_LARGE",
            `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          );
        }
        throw error;
      }

      const upload = await prisma.upload.create({
        data: {
          filename: data.filename,
          mimeType: data.mimetype,
          sizeBytes,
          storagePath: storedName,
          uploadedById: request.user.userId,
        },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      });

      return reply.code(201).send({
        data: {
          ...upload,
          url: `/uploads/${upload.id}`,
        },
      });
    },
  );

  // ─── GET /:id ── Serve uploaded file ───────────────────────────────

  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {
        tags: ["uploads"],
        summary: "Get uploaded file",
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
      const upload = await prisma.upload.findUnique({
        where: { id: request.params.id },
      });

      if (!upload) {
        return sendError(reply, 404, "FILE_NOT_FOUND", "File not found");
      }

      const filePath = path.join(UPLOAD_DIR, upload.storagePath);

      if (!fs.existsSync(filePath)) {
        return sendError(reply, 404, "FILE_NOT_FOUND", "File not found on disk");
      }

      const stream = fs.createReadStream(filePath);
      return reply.type(upload.mimeType).send(stream);
    },
  );
};

export default uploadsRoutes;
