import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import type { GenerateProvisioningPlanInput } from "../../../../../../src/application/types.js";

export class GenerateProvisioningPlanDto implements GenerateProvisioningPlanInput {
  @ApiProperty({ example: "Digital Solutions" })
  @IsString()
  @MinLength(1)
  teamPrefix!: string;

  @ApiPropertyOptional({ type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingRepositoryNames?: readonly string[];

  @ApiPropertyOptional({ example: "ds-tool-custom-name" })
  @IsOptional()
  @IsString()
  overrideRepositoryName?: string;

  @ApiPropertyOptional({ example: "Approved exception for legacy naming alignment." })
  @IsOptional()
  @IsString()
  overrideReason?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  includeMondayBoard?: boolean;

  @ApiPropertyOptional({ example: "http://localhost:3000/intakes/REQ-1" })
  @IsOptional()
  @IsString()
  intakeRecordUrl?: string;
}
