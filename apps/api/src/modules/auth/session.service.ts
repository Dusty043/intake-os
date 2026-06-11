import * as crypto from "crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { UserRole } from "../../../../../src/domain/types.js";
import type { AuthenticatedActor } from "./auth.types.js";

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string, ttlHours: number): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

    await this.prisma.authSession.create({
      data: { userId, tokenHash, expiresAt },
    });

    return token;
  }

  async validateSession(token: string): Promise<AuthenticatedActor | null> {
    const tokenHash = hashToken(token);

    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.displayName,
      role: session.user.role as UserRole,
      authProvider: "google",
      authSubject: session.user.providerSubject,
    };
  }

  async revokeSession(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await this.prisma.authSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
