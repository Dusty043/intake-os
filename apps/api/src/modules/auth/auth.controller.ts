import * as crypto from "crypto";
import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service.js";
import { Public } from "./auth.decorators.js";

const STATE_COOKIE = "oauth_state";
const STATE_COOKIE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get("google/start")
  @ApiOperation({ summary: "Start Google OAuth login" })
  googleStart(@Res() res: Response): void {
    const state = crypto.randomBytes(16).toString("hex");
    const authUrl = this.authService.getGoogleAuthUrl(state);

    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: STATE_COOKIE_TTL_MS,
      secure: process.env.AUTH_COOKIE_SECURE === "true",
    });

    res.redirect(authUrl);
  }

  @Public()
  @Get("google/callback")
  @ApiOperation({ summary: "Google OAuth callback" })
  async googleCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const failureRedirect =
      process.env.AUTH_LOGIN_FAILURE_REDIRECT ?? "/login?error=auth_failed";

    if (error) {
      res.redirect(`${failureRedirect}&reason=${encodeURIComponent(error)}`);
      return;
    }

    const expectedState = (req.cookies as Record<string, string>)?.[STATE_COOKIE];
    if (!expectedState || expectedState !== state) {
      res.redirect(`${failureRedirect}&reason=invalid_state`);
      return;
    }

    res.clearCookie(STATE_COOKIE);

    try {
      const sessionToken = await this.authService.handleGoogleCallback(code);
      const cookieName =
        process.env.AUTH_SESSION_COOKIE_NAME ?? "intake_os_session";
      const ttlHours = Number(process.env.AUTH_SESSION_TTL_HOURS ?? "8");

      res.cookie(cookieName, sessionToken, {
        httpOnly: true,
        sameSite: (process.env.AUTH_COOKIE_SAME_SITE as "lax" | "strict" | "none") ?? "lax",
        maxAge: ttlHours * 3600 * 1000,
        secure: process.env.AUTH_COOKIE_SECURE === "true",
        path: "/",
      });

      const successRedirect =
        process.env.AUTH_LOGIN_SUCCESS_REDIRECT ?? "/intakes";
      res.redirect(successRedirect);
    } catch (err: unknown) {
      const isForbidden =
        err instanceof Error && err.message.includes("not allowed");
      const reason = isForbidden ? "not_allowed" : "auth_failed";
      res.redirect(`${failureRedirect}&reason=${reason}`);
    }
  }

  @Public()
  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user" })
  async getMe(@Req() req: Request) {
    const cookieName =
      process.env.AUTH_SESSION_COOKIE_NAME ?? "intake_os_session";
    const token = (req.cookies as Record<string, string>)?.[cookieName];
    return this.authService.getMe(token);
  }

  @Public()
  @Post("logout")
  @ApiOperation({ summary: "Logout and revoke session" })
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const cookieName =
      process.env.AUTH_SESSION_COOKIE_NAME ?? "intake_os_session";
    const token = (req.cookies as Record<string, string>)?.[cookieName];
    await this.authService.logout(token);

    res.clearCookie(cookieName, { path: "/" });
    res.json({ ok: true });
  }

  @Public()
  @Get("config")
  @ApiOperation({ summary: "Return public auth config for the frontend" })
  getConfig() {
    return {
      authMode: this.authService.getAuthMode(),
    };
  }
}
