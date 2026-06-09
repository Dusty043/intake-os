import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
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
