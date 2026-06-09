import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import type { GenerateMockAnalysisDraftInput } from "../../../../../../src/application/types.js";

export class GenerateMockAnalysisDraftDto implements GenerateMockAnalysisDraftInput {
  @ApiPropertyOptional({
    example: "Client needs a small internal dashboard that summarizes Monday project throughput and developer workload.",
    description: "Optional override/normalized inquiry text. Defaults to the intake description.",
  })
  @IsOptional()
  @IsString()
  sourceInquiryText?: string;

  @ApiPropertyOptional({
    example: "Reviewer already knows this is internal-only and should not create live resources yet.",
    description: "Optional reviewer context included in the generated draft assumptions.",
  })
  @IsOptional()
  @IsString()
  reviewerContext?: string;
}
