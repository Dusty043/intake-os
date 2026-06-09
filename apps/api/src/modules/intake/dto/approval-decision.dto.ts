import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { ApprovalDecisionInput } from "../../../../../../src/application/types.js";
import { approvalGates, type ApprovalGate } from "../../../../../../src/domain/types.js";

export class ApprovalDecisionDto implements ApprovalDecisionInput {
  @ApiPropertyOptional({ enum: approvalGates, description: "Normally omitted. The API infers the open gate from the current state." })
  @IsOptional()
  @IsIn(approvalGates)
  gate?: ApprovalGate;

  @ApiPropertyOptional({ example: "Approved for POC." })
  @IsOptional()
  @IsString()
  comment?: string;
}
