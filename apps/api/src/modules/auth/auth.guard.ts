import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { actorFromHeaders } from "../../common/actor.js";
import type { AuthenticatedActor } from "./auth.types.js";
import { IS_PUBLIC_KEY } from "./auth.decorators.js";
import { SessionService } from "./session.service.js";

type IncomingRequest = {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  actor?: AuthenticatedActor;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<IncomingRequest>();
    const authMode = process.env.AUTH_MODE ?? "dev_headers";

    if (authMode === "dev_headers") {
      const base = actorFromHeaders(request.headers);
      request.actor = {
        id: base.id,
        email: "",
        name: base.displayName ?? base.id,
        role: base.role,
        authProvider: "dev_headers",
      };
      return true;
    }

    // google mode
    const cookieName =
      process.env.AUTH_SESSION_COOKIE_NAME ?? "intake_os_session";
    const sessionToken = request.cookies?.[cookieName];

    if (!sessionToken) {
      throw new UnauthorizedException({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    const actor = await this.sessionService.validateSession(sessionToken);
    if (!actor) {
      throw new UnauthorizedException({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }

    request.actor = actor;
    return true;
  }
}
