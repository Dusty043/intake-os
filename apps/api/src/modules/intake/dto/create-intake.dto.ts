import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateIntakeInput } from "../../../../../../src/application/types.js";
import { projectTypes, type ProjectType } from "../../../../../../src/domain/types.js";

export class CreateIntakeDto implements CreateIntakeInput {
  @ApiProperty({ example: "Project Intake OS" })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: "Internal intake and approval workflow." })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: "Digital Solutions" })
  @IsString()
  @MinLength(1)
  requester!: string;

  @ApiPropertyOptional({ example: "Internal Tools" })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({ enum: projectTypes, example: "internal_tool" })
  @IsIn(projectTypes)
  projectType!: ProjectType;
}
