import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./modules/admin/admin.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { Bitrix24Module } from "./modules/bitrix24/bitrix24.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IntakeModule } from "./modules/intake/intake.module.js";
import { RuntimeModule } from "./runtime/runtime.module.js";
import { loadRateLimitConfig } from "./config/rate-limit.config.js";

const rlConfig = loadRateLimitConfig();

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "global",
        ttl: rlConfig.global.ttl * 1000,
        limit: rlConfig.global.limit,
      },
    ]),
    RuntimeModule,
    AuthModule,
    HealthModule,
    IntakeModule,
    AdminModule,
    Bitrix24Module,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
