import { IsString, MaxLength, MinLength } from "class-validator";
import { MAX_REASON_LENGTH } from "../../../common/validation-constants.js";

export class RegenerateAnalysisDraftDto {
  @IsString()
  @MinLength(10)
  @MaxLength(MAX_REASON_LENGTH)
  guidance: string;
}
