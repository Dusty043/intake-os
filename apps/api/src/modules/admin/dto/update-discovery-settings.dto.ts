import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { MAX_ORG_CONTEXT_LENGTH } from "../../../common/validation-constants.js";

export class UpdateDiscoverySettingsDto {
  @ApiPropertyOptional({ example: 0.7, minimum: 0.1, maximum: 0.9 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(0.9)
  confidenceThreshold?: number;

  @ApiPropertyOptional({ description: "Injected into every discovery agent's system prompt." })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ORG_CONTEXT_LENGTH)
  orgContext?: string;
}
