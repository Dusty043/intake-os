import { IsString, MinLength } from "class-validator";

export class RegenerateAnalysisDraftDto {
  @IsString()
  @MinLength(10)
  guidance: string;
}
