import { Module } from "@nestjs/common";
import { Bitrix24Controller } from "./bitrix24.controller.js";

@Module({
  controllers: [Bitrix24Controller],
})
export class Bitrix24Module {}
