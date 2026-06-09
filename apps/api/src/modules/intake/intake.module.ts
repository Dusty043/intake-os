import { Module } from "@nestjs/common";
import { IntakeHttpController } from "./intake.controller.js";

@Module({
  controllers: [IntakeHttpController],
})
export class IntakeModule {}
