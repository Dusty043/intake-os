import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { MAX_REASON_LENGTH } from "../../../common/validation-constants.js";

export class RequestChangesDto {
  @ApiProperty({ example: "Infrastructure requirements need clarification before DevOps can sign off." })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_REASON_LENGTH)
  reason!: string;
}
