import * as crypto from "crypto";
import {
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthenticatedActor } from "./auth.types.js";
import { GoogleAuthService } from "./google-auth.service.js";
import { SessionService } from "./session.service.js";
import {
  resolveRoleConfigFromEnv,
  resolveRoleFromEmail,
} from "./role-resolver.js";

export interface AuthMeResponse {
  authenticated: boolean;
  authMode: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly session: SessionService,
    private readonly google: GoogleAuthService,
  ) {}

  getAuthMode(): string {
    return process.env.AUTH_MODE ?? "dev_headers";
  }

  generateState(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  getGoogleAuthUrl(state: string): string {
    return this.google.getAuthorizationUrl(state);
  }

  async handleGoogleCallback(code: string): Promise<string> {
    const userInfo = await this.google.exchangeCodeForUser(code);

    const config = resolveRoleConfigFromEnv();
    const role = resolveRoleFromEmail(userInfo.email, config);

    if (!role) {
      this.logger.warn(
        `Login rejected: ${userInfo.email} is not in allowed domains/emails`,
      );
      throw new ForbiddenException("User is not allowed to access this application");
    }

    // Upsert AuthUser
    const user = await this.prisma.authUser.upsert({
      where: { email: userInfo.email.toLowerCase() },
      update: {
        displayName: userInfo.name,
        role,
        lastLoginAt: new Date(),
        providerSubject: userInfo.subject,
      },
      create: {
        provider: "google",
        providerSubject: userInfo.subject,
        email: userInfo.email.toLowerCase(),
        displayName: userInfo.name,
        role,
        lastLoginAt: new Date(),
      },
    });

    const ttlHours = Number(process.env.AUTH_SESSION_TTL_HOURS ?? "8");
    const token = await this.session.createSession(user.id, ttlHours);
    return token;
  }

  async getMe(sessionToken?: string): Promise<AuthMeResponse> {
    const authMode = this.getAuthMode();

    if (!sessionToken) {
      return { authenticated: false, authMode };
    }

    const actor = await this.session.validateSession(sessionToken);
    if (!actor) {
      return { authenticated: false, authMode };
    }

    return {
      authenticated: true,
      authMode,
      user: {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        role: actor.role,
      },
    };
  }

  async logout(sessionToken?: string): Promise<void> {
    if (sessionToken) {
      await this.session.revokeSession(sessionToken);
    }
  }

  buildActorFromSession(actor: AuthenticatedActor): AuthenticatedActor {
    return actor;
  }
}
