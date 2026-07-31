import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class GeneratePhaseZeroDto {
  @ApiPropertyOptional({ default: true, description: "Generate with current information even below the automatic confidence threshold." })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
