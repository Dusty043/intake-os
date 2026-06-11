import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module.js";
import { Bitrix24Module } from "./modules/bitrix24/bitrix24.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IntakeModule } from "./modules/intake/intake.module.js";
import { RuntimeModule } from "./runtime/runtime.module.js";

@Module({
  imports: [RuntimeModule, AuthModule, HealthModule, IntakeModule, Bitrix24Module],
})
export class AppModule {}
