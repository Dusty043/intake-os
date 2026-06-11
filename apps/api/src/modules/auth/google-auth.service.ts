import { Injectable, Logger } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

export interface GoogleUserInfo {
  subject: string;
  email: string;
  name: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  getAuthorizationUrl(state: string): string {
    const client = this.buildClient();
    return client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state,
      prompt: "select_account",
    });
  }

  async exchangeCodeForUser(code: string): Promise<GoogleUserInfo> {
    const client = this.buildClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new Error("No id_token in Google token response");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.getClientId(),
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new Error("Invalid Google id_token payload");
    }

    return {
      subject: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
    };
  }

  private buildClient(): OAuth2Client {
    return new OAuth2Client(
      this.getClientId(),
      process.env.AUTH_GOOGLE_CLIENT_SECRET,
      this.getCallbackUrl(),
    );
  }

  private getClientId(): string {
    const id = process.env.AUTH_GOOGLE_CLIENT_ID;
    if (!id) throw new Error("AUTH_GOOGLE_CLIENT_ID is not configured");
    return id;
  }

  private getCallbackUrl(): string {
    const base = process.env.AUTH_PUBLIC_BASE_URL ?? "http://localhost:8080";
    const path =
      process.env.AUTH_GOOGLE_CALLBACK_PATH ?? "/api/auth/google/callback";
    return `${base}${path}`;
  }
}
