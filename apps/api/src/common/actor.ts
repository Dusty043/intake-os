import { BadRequestException, applyDecorators } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";
import type { Actor, UserRole } from "../../../../src/domain/types.js";
import { userRoles } from "../../../../src/domain/types.js";

type HeaderValue = string | string[] | undefined;
type HeaderBag = Record<string, HeaderValue>;

export function actorFromHeaders(headers: HeaderBag): Actor {
  const rawRole = singleHeader(headers["x-actor-role"]);
  const role = rawRole ? parseRole(rawRole) : "request_creator";

  return {
    id: singleHeader(headers["x-actor-id"]) || "anonymous-poc-actor",
    role,
    displayName: singleHeader(headers["x-actor-name"]) || undefined,
  };
}

export function ApiActorHeaders() {
  return applyDecorators(
    ApiHeader({
      name: "x-actor-id",
      required: false,
      description: "POC actor id. Defaults to anonymous-poc-actor when omitted.",
    }),
    ApiHeader({
      name: "x-actor-role",
      required: false,
      description: "POC role: request_creator, intake_owner, devops_lead, developer, or admin. Defaults to request_creator.",
    }),
    ApiHeader({
      name: "x-actor-name",
      required: false,
      description: "Optional display name written to audit events.",
    }),
  );
}

function parseRole(value: string): UserRole {
  if (userRoles.includes(value as UserRole)) {
    return value as UserRole;
  }

  throw new BadRequestException(`Invalid x-actor-role header: ${value}`);
}

function singleHeader(value: HeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}
