import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import {
  MAX_DISCOVERY_FIELD_LENGTH,
  MAX_EXTERNAL_ID_LENGTH,
} from "../../../common/validation-constants.js";

export class AnswerClarificationDto {
  @ApiProperty({ example: "CLARIFY-1" })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  questionId!: string;

  @ApiProperty({ example: "It should cover both internal and client-facing requests." })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_DISCOVERY_FIELD_LENGTH)
  answer!: string;
}
