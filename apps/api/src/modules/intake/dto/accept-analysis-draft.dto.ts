import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class AcceptAnalysisDraftDto {
  @ApiPropertyOptional({ description: "Optional reviewer notes" })
  @IsOptional()
  @IsString()
  reviewerNotes?: string;
}
