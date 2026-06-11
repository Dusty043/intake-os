import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { AuthenticatedActor } from "./auth.types.js";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedActor => {
    const request = ctx.switchToHttp().getRequest<{ actor?: AuthenticatedActor }>();
    return request.actor!;
  },
);
