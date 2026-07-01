import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { MAX_EXTERNAL_ID_LENGTH } from "../../../common/validation-constants.js";

export class SelectDirectionDto {
  @ApiProperty({ example: "SOL-1" })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  solutionId!: string;
}
