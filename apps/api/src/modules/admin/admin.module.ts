import { Module } from "@nestjs/common";
import { AiUsageController } from "./ai-usage.controller.js";

@Module({
  controllers: [AiUsageController],
})
export class AdminModule {}
