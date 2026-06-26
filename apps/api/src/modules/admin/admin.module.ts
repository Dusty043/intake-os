import { Module } from "@nestjs/common";
import { AiUsageController } from "./ai-usage.controller.js";
import { SettingsController } from "./settings.controller.js";
import { GlobalSettingsService } from "./global-settings.service.js";

@Module({
  controllers: [AiUsageController, SettingsController],
  providers: [GlobalSettingsService],
  exports: [GlobalSettingsService],
})
export class AdminModule {}
