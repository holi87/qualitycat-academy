import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import type { ApiErrorPayload } from "../types/shared.js";

export class DomainError extends Error {
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

export const sendError = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): FastifyReply => {
  const payload: ApiErrorPayload = {
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

export const errorHandler = (
  error: FastifyError & { validation?: unknown },
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply | void => {
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
};

export const notFoundHandler = (_: FastifyRequest, reply: FastifyReply): FastifyReply => {
  return sendError(reply, 404, "NOT_FOUND", "Route not found");
};
