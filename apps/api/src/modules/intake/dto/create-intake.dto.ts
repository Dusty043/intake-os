import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { CreateIntakeInput } from "../../../../../../src/application/types.js";
import { projectTypes, type ProjectType } from "../../../../../../src/domain/types.js";
import {
  MAX_DEPARTMENT_NAME_LENGTH,
  MAX_INTAKE_DESCRIPTION_LENGTH,
  MAX_INTAKE_TITLE_LENGTH,
  MAX_REQUESTER_NAME_LENGTH,
  MIN_INTAKE_DESCRIPTION_LENGTH,
} from "../../../common/validation-constants.js";

export class CreateIntakeDto implements CreateIntakeInput {
  @ApiProperty({ example: "Project Intake OS" })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_INTAKE_TITLE_LENGTH)
  title!: string;

  @ApiProperty({ example: "Internal intake and approval workflow." })
  @IsString()
  @MinLength(MIN_INTAKE_DESCRIPTION_LENGTH)
  @MaxLength(MAX_INTAKE_DESCRIPTION_LENGTH)
  description!: string;

  @ApiProperty({ example: "Digital Solutions" })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_REQUESTER_NAME_LENGTH)
  requester!: string;

  @ApiPropertyOptional({ example: "Internal Tools" })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DEPARTMENT_NAME_LENGTH)
  department?: string;

  @ApiProperty({ enum: projectTypes, example: "internal_tool" })
  @IsIn(projectTypes)
  projectType!: ProjectType;
}
