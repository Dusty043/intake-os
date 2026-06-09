import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { CompleteDiscoveryInput, ComplexityEstimate, DataSensitivity } from "../../../../../../src/application/types.js";

const dataSensitivities: readonly DataSensitivity[] = ["unknown", "low", "medium", "high"];
const complexityEstimates: readonly ComplexityEstimate[] = ["unknown", "low", "medium", "high"];

export class CompleteDiscoveryDto implements CompleteDiscoveryInput {
  @ApiProperty({ example: "Project requests need a traceable governance flow before provisioning." })
  @IsString()
  @MinLength(1)
  problemStatement!: string;

  @ApiPropertyOptional({ type: [String], example: ["Management", "DevOps"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stakeholders?: readonly string[];

  @ApiPropertyOptional({ type: [String], example: ["Internal requesters"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expectedUsers?: readonly string[];

  @ApiPropertyOptional({ type: [String], example: ["GitHub", "Monday", "Bitrix24"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  systemsTouched?: readonly string[];

  @ApiPropertyOptional({ enum: dataSensitivities, example: "medium" })
  @IsOptional()
  @IsIn(dataSensitivities)
  dataSensitivity?: DataSensitivity;

  @ApiPropertyOptional({ type: [String], example: ["Postgres", "container runtime"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  infraNeeds?: readonly string[];

  @ApiPropertyOptional({ enum: complexityEstimates, example: "medium" })
  @IsOptional()
  @IsIn(complexityEstimates)
  estimatedComplexity?: ComplexityEstimate;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresGithub?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresMonday?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  relatedToBitrix24?: boolean;

  @ApiPropertyOptional({ example: "No AI layer used in this POC discovery pass." })
  @IsOptional()
  @IsString()
  notes?: string;
}
