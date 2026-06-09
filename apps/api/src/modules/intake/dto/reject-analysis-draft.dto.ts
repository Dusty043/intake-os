import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RejectAnalysisDraftDto {
  @ApiProperty({ description: "Reason for rejection" })
  @IsString()
  @MinLength(1)
  reason!: string;
}
