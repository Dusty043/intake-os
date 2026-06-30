import "reflect-metadata";
import cookieParser = require("cookie-parser");
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { validateAuthConfig } from "../../../src/auth-config-validator.js";

async function bootstrap(): Promise<void> {
  // Validate auth config before any module initializes — crashes on bad production config
  const authConfig = validateAuthConfig();
  console.log(
    `[Auth] Auth mode: ${authConfig.mode} (NODE_ENV: ${process.env.NODE_ENV ?? "development"})`,
  );

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust reverse proxy (nginx on oreochiserver) so ThrottlerGuard uses real client IPs
  app.set("trust proxy", 1);

  // CORS — allow credentials so session cookies work across origins in dev
  const webOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3001,http://localhost:8080")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: webOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-actor-id", "x-actor-role", "x-actor-name"],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Project Intake OS API")
    .setDescription("No-AI MVP workflow API for intake, discovery, approvals, dry-run provisioning, audit, and Bitrix24 intake normalization.")
    .setVersion("0.2.1")
    .addApiKey({ type: "apiKey", name: "x-actor-id", in: "header" }, "actor-id")
    .addApiKey({ type: "apiKey", name: "x-actor-role", in: "header" }, "actor-role")
    .addApiKey({ type: "apiKey", name: "x-actor-name", in: "header" }, "actor-name")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
