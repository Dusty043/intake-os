import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { MAX_REASON_LENGTH } from "../../../common/validation-constants.js";

export class RejectAnalysisDraftDto {
  @ApiProperty({ description: "Reason for rejection" })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_REASON_LENGTH)
  reason!: string;
}
