import { FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "./errors.js";
import { isBugEnabled } from "./bugs.js";
import type { JwtUser } from "../types/shared.js";

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

export const getAuthFailureStatus = (): number => (isBugEnabled("BUG_AUTH_WRONG_STATUS") ? 403 : 401);

export const createAuthenticateDecorator = () => {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await request.jwtVerify<JwtUser>();
    } catch {
      sendError(reply, getAuthFailureStatus(), "UNAUTHORIZED", "Authentication required");
    }
  };
};
