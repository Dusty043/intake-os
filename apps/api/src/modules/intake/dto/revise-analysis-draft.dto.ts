import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ReviseAnalysisDraftDto {
  @ApiProperty({ description: "Human-edited reviewed project package" })
  reviewedPackage!: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Optional reviewer notes" })
  @IsOptional()
  @IsString()
  reviewerNotes?: string;
}
